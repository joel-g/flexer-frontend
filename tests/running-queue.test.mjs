import test from 'node:test';
import assert from 'node:assert/strict';
import { RunningQueue } from '../src/running/queue.ts';
import { RunningApiError } from '../src/running/client.ts';
const account = { userId: 'synthetic-user', incarnation: 'synthetic-incarnation' };
function harness() {
  const values = new Map(), tails = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  const locks = { async exclusive(key, action) { const previous = tails.get(key) ?? Promise.resolve(); let release; const next = new Promise(resolve => { release = resolve; }); tails.set(key, next); await previous; try { return await action(); } finally { release(); if (tails.get(key) === next) tails.delete(key); } } };
  const create = (owner = account) => new RunningQueue(owner, storage, locks);
  return { values, storage, create };
}
const body = (id = 'mutation-1', revision = 0) => ({ mutationId: id === 'mutation-1' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222', expectedRevision: revision, status: 'completed', actualDate: '2026-10-20', actualDistance: { value: 3, unit: 'km' }, durationSeconds: 1200, paceSecondsPerKm: null, effortRpe: 5, notes: 'Synthetic note' });
const ack = entry => ({ id: entry.runId, planId: entry.planId, revision: entry.payload.expectedRevision + 1, originalDate: '2026-10-20', scheduledDate: '2026-10-20', status: entry.payload.status, actualDate: entry.payload.actualDate, actualMeters: entry.payload.actualDistance ? 3000 : null, durationSeconds: entry.payload.durationSeconds, durationSource: entry.payload.durationSeconds ? 'entered' : null, effortRpe: entry.payload.effortRpe ?? null, notes: entry.payload.notes ?? null });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('queue starts paused and persists before success; storage errors never report saved', async () => {
  const h = harness(), queue = h.create();
  await assert.rejects(queue.enqueue('plan', 'run', body()), /paused/);
  queue.resume(account); h.storage.setItem = () => { throw new Error('full'); };
  await assert.rejects(queue.enqueue('plan', 'run', body()), /full/);
  assert.deepEqual(await queue.snapshot(), []);
});
test('pending edits survive reload without automatic replay and cannot cross account/incarnation', async () => {
  const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body());
  const reloaded = h.create(); let calls = 0; await reloaded.flushRun('plan', 'run', async entry => { calls++; return ack(entry); });
  assert.equal(calls, 0); assert.equal((await reloaded.snapshot()).length, 1);
  assert.throws(() => reloaded.resume({ ...account, userId: 'other' }), /different/);
  assert.deepEqual(await h.create({ ...account, incarnation: 'other' }).snapshot(), []);
});
test('unchanged retry uses immutable mutation; changed payload cannot reuse its ID', async () => {
  const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body()); await queue.enqueue('plan', 'run', body());
  await assert.rejects(queue.enqueue('plan', 'run', { ...body(), notes: 'changed' }), /cannot be changed/);
  await queue.flushRun('plan', 'run', async () => { throw new Error('offline'); });
  assert.equal((await queue.snapshot())[0].state, 'retry-wait');
  await queue.flushRun('plan', 'run', async entry => { assert.deepEqual(entry.payload, body()); return ack(entry); });
  assert.deepEqual(await queue.snapshot(), []);
});
test('same-run newer edit survives earlier acknowledgment and is sent at next revision', async () => {
  const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body());
  const sending = deferred(), finish = deferred(), revisions = [];
  const flush = queue.flushRun('plan', 'run', async entry => { revisions.push(entry.payload.expectedRevision); if (revisions.length === 1) { sending.resolve(); await finish.promise; } return ack(entry); });
  await sending.promise; await queue.enqueue('plan', 'run', body('mutation-2', 1)); finish.resolve(); await flush;
  assert.deepEqual(revisions, [0, 1]); assert.deepEqual(await queue.snapshot(), []);
});
test('different runs progress independently while one run is in flight', async () => {
  const h = harness(), queue = h.create(); queue.resume(account);
  await queue.enqueue('plan', 'one', body()); await queue.enqueue('plan', 'two', body('mutation-2'));
  const started = deferred(), finish = deferred();
  const first = queue.flushRun('plan', 'one', async entry => { started.resolve(); await finish.promise; return ack(entry); });
  await started.promise; await queue.flushRun('plan', 'two', async entry => ack(entry));
  assert.equal((await queue.snapshot()).length, 1); finish.resolve(); await first;
});
test('shared tab writer lock prevents double send and preserves concurrent enqueue', async () => {
  const h = harness(), a = h.create(), b = h.create(); a.resume(account); b.resume(account);
  await Promise.all([a.enqueue('plan', 'one', body()), b.enqueue('plan', 'two', body('mutation-2'))]);
  let calls = 0;
  await Promise.all([a.flushRun('plan', 'one', async entry => { calls++; return ack(entry); }), b.flushRun('plan', 'one', async entry => { calls++; return ack(entry); })]);
  assert.equal(calls, 1); assert.equal((await a.snapshot())[0].runId, 'two');
});
test('malformed or wrong-measurement acknowledgment retains pending data', async () => {
  for (const patch of [{ actualMeters: 1 }, { notes: 'wrong' }, { revision: 3 }, { id: 'other' }]) {
    const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body());
    await queue.flushRun('plan', 'run', async entry => ({ ...ack(entry), ...patch })); assert.equal((await queue.snapshot()).length, 1);
  }
});
test('auth pause hides replay; late acknowledgment cannot discard durable work', async () => {
  const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body());
  const started = deferred(), finish = deferred(); const flush = queue.flushRun('plan', 'run', async entry => { started.resolve(); await finish.promise; return ack(entry); });
  await started.promise; queue.pause(); finish.resolve(); await flush; assert.equal((await queue.snapshot()).length, 1);
});
test('explicit clear cannot be resurrected by an in-flight response and preserves another account', async () => {
  const h = harness(), queue = h.create(), other = h.create({ ...account, userId: 'other' }); queue.resume(account); other.resume({ ...account, userId: 'other' });
  await queue.enqueue('plan', 'run', body()); await other.enqueue('plan', 'run', body());
  const started = deferred(), finish = deferred(); const flush = queue.flushRun('plan', 'run', async entry => { started.resolve(); await finish.promise; return ack(entry); });
  await started.promise; await queue.clear(); finish.resolve(); await flush;
  assert.deepEqual(await queue.snapshot(), []); assert.equal((await other.snapshot()).length, 1);
});
test('validation, conflict and disabled failures retain distinct recoverable states', async () => {
  for (const [status, code, state] of [[422, 'VALIDATION_FAILED', 'needs-correction'], [409, 'REVISION_CONFLICT', 'conflict'], [403, 'FEATURE_DISABLED', 'paused-feature'], [401, 'AUTH_REQUIRED', 'paused-auth']]) {
    const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body());
    await queue.flushRun('plan', 'run', async () => { throw new RunningApiError(status, { code, error: 'Synthetic error' }); });
    assert.equal((await queue.snapshot())[0].state, state);
  }
});
test('corrupt storage is preserved instead of replaced', async () => {
  const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body()); const key = [...h.values.keys()][0]; h.values.set(key, '{broken');
  await assert.rejects(queue.enqueue('plan', 'two', body('mutation-2')), /unreadable/); assert.equal(h.values.get(key), '{broken');
});
test('attempted marker persists before dispatch and survives an uncertain response', async () => {
  const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body());
  assert.equal((await queue.snapshot())[0].attempted, false);
  await queue.flushRun('plan', 'run', async entry => { assert.equal(entry.attempted, true); assert.equal((await h.create().snapshot())[0].attempted, true); throw new Error('response lost'); });
  assert.equal((await h.create().snapshot())[0].attempted, true);
});
test('explicit recovery after fresh same-account confirmation enables paused entries without changing payload', async () => {
  const h = harness(), queue = h.create(); queue.resume(account); await queue.enqueue('plan', 'run', body());
  await queue.flushRun('plan', 'run', async () => { throw new RunningApiError(401, { code: 'AUTH_REQUIRED', error: 'expired' }); });
  const reloaded = h.create(); await assert.rejects(reloaded.recover({ ...account, incarnation: 'different' }), /different/);
  await reloaded.recover(account); assert.equal((await reloaded.snapshot())[0].state, 'pending');
  await reloaded.flushRun('plan', 'run', async entry => { assert.deepEqual(entry.payload, body()); return ack(entry); }); assert.deepEqual(await reloaded.snapshot(), []);
});
test('missing duration source and oversized notes cannot silently acknowledge a run', async () => {
  const h = harness(), queue = h.create(); queue.resume(account);
  await assert.rejects(queue.enqueue('plan', 'run', { ...body(), notes: 'x'.repeat(2001) }), /Correct/);
  await queue.enqueue('plan', 'run', body());
  await queue.flushRun('plan', 'run', async entry => ({ ...ack(entry), durationSource: null }));
  assert.equal((await queue.snapshot()).length, 1);
});
test('clearing in another tab rejects its stale writer and late response; only explicit recovery reopens an empty queue', async () => {
  const h = harness(), a = h.create(), b = h.create(); a.resume(account); b.resume(account);
  await a.enqueue('plan', 'run', body());
  const started = deferred(), finish = deferred(); const flush = a.flushRun('plan', 'run', async entry => { started.resolve(); await finish.promise; return ack(entry); });
  await started.promise; await b.clear(); finish.resolve(); await flush;
  await assert.rejects(a.enqueue('plan', 'two', body('mutation-2')));
  assert.deepEqual(await b.snapshot(), []); await a.recover(account); assert.deepEqual(await a.snapshot(), []);
  assert.equal([...h.values.values()][0].includes('Synthetic note'), false);
});
