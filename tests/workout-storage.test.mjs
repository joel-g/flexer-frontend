import test from 'node:test';
import assert from 'node:assert/strict';
import { DurableSetQueue, migrateLegacyQueue, queueKey, LEGACY_QUEUE_KEY, clearAccountStorage, validateSetRequest } from '../src/services/workoutStorage.ts';
class MemoryStorage {
  data = new Map(); get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k,v) { this.data.set(k,v); }
  removeItem(k) { this.data.delete(k); }
}
const item = (reps = 5, sessionId = 'session-a') => ({ sessionId, request: { exerciseId:'e1', exerciseName:'Exercise', setNumber:1, loadType:'bodyweight', actualReps: reps, completed:true, loggedAt:'2026-10-23T00:00:00Z' } });
test('failed logs survive repeated retries and remount, then acknowledge exactly once', async () => {
  const s = new MemoryStorage(); const key=queueKey('user-a','plan-a'); let q=new DurableSetQueue(s,key);
  q.enqueue(item());
  for(let i=0;i<12;i++) await assert.rejects(q.flush(async()=>{throw Error('offline')}));
  q = new DurableSetQueue(s,key); assert.equal(q.items().length,1);
  let writes=0; await q.flush(async()=>{writes++}); await q.flush(async()=>{writes++});
  assert.equal(writes,1); assert.deepEqual(q.items(),[]);
});
test('a newer edit made while an earlier request is in flight survives that acknowledgement', async () => {
  const s=new MemoryStorage(); const q=new DurableSetQueue(s,queueKey('a','p')); q.enqueue(item(5));
  let release; const gate=new Promise(r=>{release=r}); const first=q.flush(async()=>{await gate});
  q.enqueue(item(8)); release(); await first;
  assert.equal(q.items()[0].request.actualReps,8); let sent; await q.flush(async i=>{sent=i.request.actualReps});
  assert.equal(sent,8); assert.equal(q.items().length,0);
});
test('storage failure cannot pretend to save a set', () => {
  const s=new MemoryStorage(); s.setItem=()=>{throw Error('quota')};
  assert.throws(()=>new DurableSetQueue(s,'q').enqueue(item()),/quota/);
});
test('corrupt queued records are not overwritten', () => {
  const s=new MemoryStorage(); s.setItem('q','corrupt');
  assert.throws(()=>new DurableSetQueue(s,'q').enqueue(item())); assert.equal(s.getItem('q'),'corrupt');
});
test('user and plan isolation, legacy queue requires verified ownership and matching plan', async () => {
  const s=new MemoryStorage(); const own=item(5,'own'); const other=item(9,'other'); const otherPlan=item(4,'other-plan');
  s.setItem(LEGACY_QUEUE_KEY,JSON.stringify([own,other,otherPlan]));
  const qa=new DurableSetQueue(s,queueKey('a','p')); const qb=new DurableSetQueue(s,queueKey('b','p'));
  await migrateLegacyQueue(s,qa,'p',async id=>id==='own'?{planId:'p'}:id==='other-plan'?{planId:'p2'}:null);
  assert.deepEqual(qa.items(),[own]); assert.deepEqual(qb.items(),[]);
  assert.deepEqual(JSON.parse(s.getItem(LEGACY_QUEUE_KEY)),[other,otherPlan]);
});
test('failed migration leaves original legacy log intact', async()=>{
  const s=new MemoryStorage();s.setItem(LEGACY_QUEUE_KEY,JSON.stringify([item()]));
  const q=new DurableSetQueue(s,queueKey('a','p'));
  await assert.rejects(migrateLegacyQueue(s,q,'p',async()=>{throw Error('offline')}));
  assert.equal(JSON.parse(s.getItem(LEGACY_QUEUE_KEY)).length,1);
});
test('account cleanup clears owned queue and actual display caches, preserves other users',()=>{
  const s=new MemoryStorage(); s.setItem(queueKey('a','p'),'[]');s.setItem(queueKey('b','p'),'[]');
  s.setItem('workout-progress','{}');s.setItem('flexer-theme','dark');
  clearAccountStorage(s,'a'); assert.equal(s.getItem(queueKey('a','p')),null);assert.equal(s.getItem('workout-progress'),null);
  assert.equal(s.getItem('flexer-theme'),null);assert.equal(s.getItem(queueKey('b','p')),'[]');
});
test('invalid or missing metrics cannot become an unrecoverable queued set',()=>{
  assert.throws(()=>validateSetRequest({...item().request,actualReps:undefined}),/reps/);
  assert.throws(()=>validateSetRequest({...item().request,actualReps:-1}),/non-negative/);
  assert.throws(()=>validateSetRequest({...item().request,loadType:'timed',actualReps:undefined}),/duration/);
  assert.doesNotThrow(()=>validateSetRequest({...item().request,actualReps:0}));
});
import { recoverCompletionMarker } from '../src/services/workoutStorage.ts';
const recoveryPlan = { weeks: [{ days: [{ id:'day-a' }, { id:'day-b' }] }] };
const recoverySession = { id:'session-a', planId:'plan-a', workoutDayId:'day-a', weekNumber:1, dayNumber:1, status:'completed' };
test('acknowledged completion clears stale marker without rewinding advanced server navigation or losing queued sets', () => {
  const s=new MemoryStorage(); const marker='completion'; s.setItem(marker,JSON.stringify('session-a'));
  const q=new DurableSetQueue(s,queueKey('user-a','plan-a'));q.enqueue(item());
  const saved={currentWeek:0,currentDay:1,completedWorkouts:['day-a']};
  const result=recoverCompletionMarker(s,marker,saved,recoverySession,recoveryPlan);
  assert.deepEqual(result,{progress:saved,resume:false});assert.equal(s.getItem(marker),null);
  assert.equal(result.progress.currentDay,1);assert.equal(q.items().length,1);
});
test('completed session with unacknowledged progress restores original workout for retry and retains marker',()=>{
  const s=new MemoryStorage();s.setItem('completion',JSON.stringify('session-a'));
  const saved={currentWeek:0,currentDay:1,completedWorkouts:[]};
  const result=recoverCompletionMarker(s,'completion',saved,recoverySession,recoveryPlan);
  assert.equal(result.resume,true);assert.equal(result.progress.currentDay,0);
  assert.equal(s.getItem('completion'),JSON.stringify('session-a'));assert.equal(saved.currentDay,1);
});
test('in-progress repeated workout still resumes even when an earlier run is marked complete',()=>{
  const s=new MemoryStorage();s.setItem('completion',JSON.stringify('session-a'));
  const result=recoverCompletionMarker(s,'completion',{currentWeek:0,currentDay:1,completedWorkouts:['day-a']},{...recoverySession,status:'in_progress'},recoveryPlan);
  assert.equal(result.resume,true);assert.equal(result.progress.currentDay,0);assert.notEqual(s.getItem('completion'),null);
});
