import test from 'node:test';
import assert from 'node:assert/strict';
import { RunningController } from '../src/running/controller.ts';
import { RunningApiError } from '../src/running/client.ts';
import { clearRunningAccount, clearRunningPlan } from '../src/running/privacy.ts';
import { dayValue, mondayOf, planToday } from '../src/running/calendar.ts';
const account = { userId: 'synthetic-controller', incarnation: '10000000-0000-4000-8000-000000000001' };
const body = { mutationId: '11111111-1111-4111-8111-111111111111', expectedRevision: 0, status: 'completed', actualDate: '2026-10-20', actualDistance: { value: 3, unit: 'km' }, durationSeconds: null, paceSecondsPerKm: null, effortRpe: null, notes: null };
function harness(result) {
  const values = new Map(); const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => values.delete(key) };
  const locks = { exclusive: async (_name, action) => action() };
  const seen = [], failures = [];
  const controller = new RunningController({ account, storage, locks, client: { result }, onRun: run => seen.push(run), onPrivacyFailure: error => failures.push(error) });
  return { controller, storage, locks, values, seen, failures };
}
const ack = { id: 'run', planId: 'plan', revision: 1, status: 'completed', actualDate: body.actualDate, actualMeters: 3000, durationSeconds: null, durationSource: null, effortRpe: null, notes: null, originalDate: body.actualDate, scheduledDate: body.actualDate };
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
test('controller never publishes an unvalidated mismatched measurement acknowledgment', async () => {
  const h = harness(async () => ({ status: 200, data: { ...ack, actualMeters: 1 } }));
  await h.controller.initialize(); h.controller.setOnline(false); await h.controller.save('plan', 'run', body); h.controller.setOnline(true); await turn();
  assert.deepEqual(h.seen, []); assert.equal(h.controller.snapshot().entries.length, 1); assert.ok(h.controller.snapshot().retryAt); h.controller.dispose();
});
test('controller publishes a validated acknowledgment and clears confirmed queue entry', async () => {
  const h = harness(async () => ({ status: 200, data: ack })); await h.controller.initialize(); h.controller.setOnline(false); await h.controller.save('plan', 'run', body); h.controller.setOnline(true); await turn();
  assert.equal(h.seen.length, 1); assert.deepEqual(h.controller.snapshot().entries, []); h.controller.dispose();
});
test('controller privacy failure hides entries even if error persistence fails', async () => {
  let h; h = harness(async () => { h.storage.setItem = () => { throw new Error('quota'); }; throw new RunningApiError(401, { code: 'AUTH_REQUIRED', error: 'expired' }); });
  await h.controller.initialize(); h.controller.setOnline(false); await h.controller.save('plan', 'run', body); h.controller.setOnline(true); await turn();
  assert.equal(h.controller.snapshot().paused, true); assert.deepEqual(h.controller.snapshot().entries, []); assert.equal(h.failures.length, 1); assert.equal(h.values.size, 1); h.controller.dispose();
});
test('initial storage load cannot resume a newer privacy pause', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const controller = new RunningController({ account, storage: { getItem: () => null, setItem() {}, removeItem() {} }, locks: { exclusive: async (_name, action) => { await gate; return action(); } }, client: { result: async () => ({ data: ack, status: 200 }) }, onRun() {} });
  const loading = controller.initialize(); controller.pause(); release(); await loading; assert.equal(controller.snapshot().paused, true); controller.dispose();
});
test('repeat clear under a fixed clock increments generation and preserves foreign account', async () => {
  const h = harness(async () => ({ data: ack, status: 200 })); await h.controller.initialize(); h.controller.setOnline(false); await h.controller.save('plan', 'run', body);
  const own = [...h.values.keys()][0]; const other = 'flexer:running:v1:["other","inc"]'; h.values.set(other, 'untouched');
  const now = Date.now; Date.now = () => 10;
  try { await clearRunningAccount(h.storage, h.locks, account.userId); const first = JSON.parse(h.values.get(own)).clearGeneration; await clearRunningAccount(h.storage, h.locks, account.userId); assert.equal(JSON.parse(h.values.get(own)).clearGeneration, first + 1); assert.equal(h.values.get(other), 'untouched'); } finally { Date.now = now; h.controller.dispose(); }
});
test('plan dates use fixed timezone and Monday groups without local UTC display shifts', () => {
  const now = new Date('2026-10-23T00:30:00Z'); assert.equal(planToday('America/Los_Angeles', now), '2026-10-22'); assert.equal(planToday('Pacific/Auckland', now), '2026-10-23');
  assert.equal(mondayOf('2026-10-25'), '2026-10-19'); assert.equal(mondayOf('2026-10-26'), '2026-10-26'); assert.throws(() => dayValue('2026-02-30'));
});
test('another-tab clear while response is held cannot publish a private run', async () => {
  const started = deferred(), finish = deferred(); const h = harness(async () => { started.resolve(); await finish.promise; return { status: 200, data: ack }; });
  await h.controller.initialize(); await h.controller.save('plan', 'run', body); await started.promise;
  await clearRunningAccount(h.storage, h.locks, account.userId); finish.resolve(); await turn(); assert.deepEqual(h.seen, []); assert.equal(h.controller.snapshot().paused, true); h.controller.dispose();
});
test('new independent run queued during active flush is sent after that pass drains', async () => {
  const started = deferred(), finish = deferred(), calls = [];
  const h = harness(async (_planId, runId, payload) => { calls.push(runId); if (runId === 'run') { started.resolve(); await finish.promise; } return { status: 200, data: { ...ack, id: runId, revision: payload.expectedRevision + 1 } }; });
  await h.controller.initialize(); await h.controller.save('plan', 'run', body); await started.promise;
  await h.controller.save('plan', 'other', { ...body, mutationId: '22222222-2222-4222-8222-222222222222' }); finish.resolve(); await turn(); await turn(); assert.deepEqual(calls, ['run', 'other']); h.controller.dispose();
});
test('new save and reconnect cannot bypass server Retry-After deadline', async () => {
  let calls = 0; const h = harness(async () => { calls++; throw new RunningApiError(429, { code: 'RATE_LIMITED', error: 'Wait' }, 60000); });
  await h.controller.initialize(); await h.controller.save('plan', 'run', body); await turn();
  assert.equal(calls, 1); await h.controller.save('plan', 'other', { ...body, mutationId: '22222222-2222-4222-8222-222222222222' }); h.controller.setOnline(false); h.controller.setOnline(true); await turn(); assert.equal(calls, 1); h.controller.dispose();
});
test('plan cleanup retains other plans and accounts while invalidating stale writers', async () => {
  const h = harness(async () => ({ data: ack, status: 200 })); await h.controller.initialize(); h.controller.setOnline(false); await h.controller.save('plan', 'run', body);
  await h.controller.save('other-plan', 'other-run', { ...body, mutationId: '22222222-2222-4222-8222-222222222222' });
  const own = [...h.values.keys()][0]; const foreign = 'flexer:running:v1:["other-user","inc"]'; h.values.set(foreign, 'private foreign');
  await clearRunningPlan(h.storage, h.locks, account.userId, 'plan'); const retained = JSON.parse(h.values.get(own)); assert.equal(retained.entries.length, 1); assert.equal(retained.entries[0].planId, 'other-plan'); assert.equal(h.values.get(foreign), 'private foreign');
  await assert.rejects(h.controller.queue.enqueue('plan', 'run', body)); h.controller.dispose();
});
