import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RunningClient, RunningApiError, RunningIdentityChangedError } from '../src/running/client.ts';
import { RunningState, pendingDisposition } from '../src/running/state.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/running-contract.json', import.meta.url)));
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setImmediate(r));
function ready(fetcher) {
  const client = new RunningClient('https://synthetic.invalid/', fetcher);
  client.setIdentity('synthetic-account-a', async () => 'synthetic-token');
  client.bindIncarnation(client.scope(), fixture.headers['X-Account-Incarnation']);
  return client;
}

test('vendored DTO and golden fixtures match the frozen shared contract hashes', () => {
  const hash = url => createHash('sha256').update(readFileSync(new URL(url, import.meta.url))).digest('hex');
  assert.equal(hash('../src/running/contract.ts'), 'd62bf8ec2b04e11abb16dbd01813da8dbd86e1acd1f09fcfa9f2c06f9e11eee1');
  assert.equal(hash('./fixtures/running-contract.json'), '61d7ecfb5dd4df1ed30f44a0af5452049a0873182e5f1a14e5374e3783b14450');
});
test('draft listing uses the frozen query and opaque escaped cursor without a write', async () => {
  let calls = 0;
  const client = ready(async (url, init) => {
    calls++;
    const query = new URL(url).searchParams;
    assert.equal(query.get('lifecycle'), 'draft'); assert.equal(query.get('limit'), '20'); assert.equal(query.get('cursor'), 'opaque+cursor/=');
    assert.equal(init.method, 'GET'); assert.equal(init.body, undefined);
    return json({ success: true, data: { items: [], nextCursor: null, historyGeneration: 3 } });
  });
  assert.equal((await client.plans({ lifecycle: 'draft', limit: 20, cursor: 'opaque+cursor/=' })).data.historyGeneration, 3);
  assert.throws(() => client.plans({ lifecycle: 'draft', limit: 51, cursor: null }), /Invalid/);
  assert.equal(calls, 1);
});
test('uninitialized, missing and rejected token requests never fetch', async () => {
  let calls = 0;
  const client = new RunningClient('https://synthetic.invalid', async () => { calls++; throw Error('unexpected'); });
  await assert.rejects(client.state(), e => e.code === 'AUTH_REQUIRED');
  client.setIdentity('a', async () => null);
  await assert.rejects(client.state(), e => e.code === 'AUTH_REQUIRED');
  client.setIdentity('a', async () => { throw Error('sensitive provider internals'); });
  await assert.rejects(client.state(), e => e.code === 'AUTH_REQUIRED' && !e.message.includes('sensitive'));
  assert.equal(calls, 0);
});
test('token acquisition from an old account cannot start a request', async () => {
  const token = deferred(); let calls = 0;
  const client = new RunningClient('https://synthetic.invalid', async () => { calls++; return json({ success: true, data: {} }); });
  client.setIdentity('a', () => token.promise);
  const pending = client.state();
  client.setIdentity('b', async () => 'b-token');
  token.resolve('a-token');
  await assert.rejects(pending, RunningIdentityChangedError);
  assert.equal(calls, 0);
});
test('in-flight and body-parsing responses are rejected after identity or incarnation changes', async () => {
  for (const change of ['identity', 'incarnation']) {
    const body = deferred(); let signal;
    const client = ready(async (_url, init) => { signal = init.signal; return { ok: true, status: 200, headers: new Headers(), json: () => body.promise }; });
    const pending = client.state(); await tick();
    if (change === 'identity') client.setIdentity('b', async () => 'b-token');
    else client.bindIncarnation(client.scope(), 'new-incarnation');
    assert.equal(signal.aborted, true);
    body.resolve({ success: true, data: { private: 'old account' } });
    await assert.rejects(pending, RunningIdentityChangedError);
  }
});
test('data writes require the acknowledged incarnation and never silently bootstrap', async () => {
  let calls = 0;
  const client = new RunningClient('https://synthetic.invalid', async () => { calls++; return json({ success: true, data: {} }); });
  client.setIdentity('a', async () => 'token');
  await assert.rejects(client.createDraft({ intake: fixture.intake }, fixture.headers['X-Operation-Id']), e => e.code === 'ACCOUNT_REPLACED');
  assert.equal(calls, 0);
});
test('import preserves direct text and all exact contract headers', async () => {
  let observed;
  const client = ready(async (url, init) => { observed = { url, ...init }; return json({ success: true, data: {} }); });
  const text = '```json\n' + JSON.stringify(fixture.import) + '\n```';
  await client.importPlan('plan/with slash', text, 3, fixture.headers['X-Operation-Id']);
  assert.equal(observed.url, 'https://synthetic.invalid/running/plans/plan%2Fwith%20slash/import');
  assert.equal(observed.body, text);
  assert.equal(observed.headers.get('Authorization'), 'Bearer synthetic-token');
  for (const key of ['X-Operation-Id', 'X-Account-Incarnation', 'If-Match', 'Content-Type']) assert.equal(observed.headers.get(key), fixture.headers[key]);
  assert.equal(observed.credentials, 'omit');
});
test('UTF8 import limit applies before fetch and payload is not logged or returned in errors', async () => {
  let calls = 0;
  const client = ready(async () => { calls++; return json({ success: true, data: {} }); });
  await assert.rejects(client.importPlan('p', '😀'.repeat(262145), 0, fixture.headers['X-Operation-Id']), e => e.code === 'PAYLOAD_TOO_LARGE' && !e.message.includes('😀'));
  assert.equal(calls, 0);
});
test('result undo uses PUT with stable mutation ID; deletion uses headers without a body', async () => {
  const requests = [];
  const client = ready(async (url, init) => { requests.push({ url, ...init }); return json({ success: true, data: init.method === 'DELETE' ? { deleted: true } : { ...fixture.canonicalRun, id: 'r', planId: 'p', revision: fixture.resultUndo.expectedRevision + 1, status: 'pending', actualDate: null, actualMeters: null, durationSeconds: null, durationSource: null, effortRpe: null, notes: null } }); });
  await client.result('p', 'r', fixture.resultUndo);
  assert.equal(requests[0].method, 'PUT');
  assert.deepEqual(JSON.parse(requests[0].body), fixture.resultUndo);
  await client.deletePlan('p', 5);
  assert.equal(requests[1].method, 'DELETE');
  assert.equal(requests[1].body, undefined);
  assert.equal(requests[1].headers.get('If-Match'), '"5"');
});
test('malformed or mismatched 2xx run acknowledgments cannot clear pending work', async () => {
  const request = fixture.resultPace;
  const valid = { ...fixture.canonicalRun, revision: request.expectedRevision + 1 };
  const positive = ready(async () => json({ success: true, data: valid }));
  assert.deepEqual((await positive.result(valid.planId, valid.id, request)).data, valid);
  for (const data of [null, {}, { ...valid, id: 'other-run' }, { ...valid, planId: 'other-plan' }, { ...valid, revision: request.expectedRevision }, { ...valid, actualMeters: null }]) {
    const client = ready(async () => json({ success: true, data }));
    await assert.rejects(client.result(fixture.canonicalRun.planId, fixture.canonicalRun.id, request), e => pendingDisposition(e) === 'retry-wait');
  }
});
test('schedule acknowledgments must identify the pending run and requested date', async () => {
  const valid = { ...fixture.canonicalRun, revision: fixture.schedule.expectedRevision + 1, status: 'pending', scheduledDate: fixture.schedule.date, actualDate: null, actualMeters: null, durationSeconds: null, durationSource: null };
  const accepted = ready(async () => json({ success: true, data: valid }));
  assert.deepEqual((await accepted.schedule(valid.planId, valid.id, fixture.schedule)).data, valid);
  const rejected = ready(async () => json({ success: true, data: { ...valid, scheduledDate: '2026-10-25' } }));
  await assert.rejects(rejected.schedule(valid.planId, valid.id, fixture.schedule), e => pendingDisposition(e) === 'retry-wait');
});
test('auth pause clears accessible private run state without discarding a persistent queue', () => {
  const state = new RunningState();
  const scope = { userId: 'a', incarnation: 'a-incarnation', epoch: 1 };
  state.bind(scope);
  const run = fixture.canonicalRun;
  state.acceptRun(scope, run.planId, run.id, run);
  state.fail(state.begin(), new RunningApiError(401, { code: 'AUTH_REQUIRED', error: 'Sign in' }));
  assert.equal(state.run(run.planId, run.id), null);
  assert.equal(state.snapshot().data, null);
});
test('structured errors preserve status, field paths and canonical conflict state', async () => {
  for (const [name, status, disposition] of [['disabled', 403, 'paused-feature'], ['notFound', 404, 'conflict'], ['validation', 422, 'needs-correction'], ['conflict', 409, 'conflict']]) {
    const client = ready(async () => json(fixture.responses[name], status));
    await assert.rejects(client.plan('p'), error => {
      assert.equal(error.status, status);
      assert.equal(error.code, fixture.responses[name].code);
      assert.equal(pendingDisposition(error), disposition);
      assert.deepEqual(error.fieldErrors, fixture.responses[name].fieldErrors ?? []);
      assert.deepEqual(error.current, fixture.responses[name].current);
      return true;
    });
  }
});
test('failed HTTP success envelopes cannot acknowledge saves, malformed responses retain retry disposition', async () => {
  for (const response of [() => json({ success: true, data: fixture.canonicalRun }, 500), () => new Response('<html>unavailable</html>', { status: 503 }), () => json({ success: true }, 200)]) {
    const client = ready(async () => response());
    await assert.rejects(client.result('p', 'r', fixture.resultUndo), e => e instanceof RunningApiError && pendingDisposition(e) === 'retry-wait');
  }
});
test('rate limits retain retry-after and network errors do not leak provider text', async () => {
  const limited = ready(async () => json({ success: false, code: 'RATE_LIMITED', error: 'Try later', requestId: 'synthetic' }, 429, { 'Retry-After': '7' }));
  await assert.rejects(limited.state(), e => e.retryAfterMs === 7000 && pendingDisposition(e) === 'retry-wait');
  const network = ready(async () => { throw Error('private transport payload'); });
  await assert.rejects(network.state(), e => e.code === 'TEMPORARY_FAILURE' && !e.message.includes('private'));
});
test('all queue decisions preserve intent and identity-change responses are ignored', () => {
  assert.equal(pendingDisposition(new RunningApiError(401, { code: 'AUTH_REQUIRED', error: '' })), 'paused-auth');
  assert.equal(pendingDisposition(new RunningIdentityChangedError()), 'ignore-stale-response');
  for (const code of ['REVISION_CONFLICT', 'STALE_OPERATION', 'OPERATION_ID_REUSED', 'ACCOUNT_REPLACED', 'SCHEDULE_COLLISION', 'HISTORY_CHANGED']) assert.equal(pendingDisposition(new RunningApiError(409, { code, error: '' })), 'conflict');
});
test('state distinguishes disabled from empty, ignores superseded loads and clears synchronously on account switch', () => {
  const state = new RunningState();
  assert.throws(() => state.begin(), /Initialize/);
  state.bind({ userId: 'a', incarnation: null, epoch: 1 });
  const first = state.begin(), latest = state.begin();
  assert.equal(state.accept(latest, fixture.responses.featureState.data), true);
  assert.equal(state.snapshot().phase, 'disabled');
  assert.equal(state.accept(first, { enabled: true, account: null, activePlan: null, draftCount: 0 }), false);
  state.bind({ userId: 'b', incarnation: null, epoch: 2 });
  assert.deepEqual(state.snapshot(), { phase: 'loading', data: null, error: null });
  assert.equal(state.accept(latest, fixture.responses.featureState.data), false);
});
test('run state rejects wrong resource, old revision and old account scope independently per run', () => {
  const state = new RunningState();
  const scope = { userId: 'a', incarnation: 'incarnation-a', epoch: 1 };
  state.bind(scope);
  const run = fixture.canonicalRun;
  assert.equal(state.acceptRun(scope, run.planId, run.id, run), true);
  assert.equal(state.acceptRun(scope, 'wrong-plan', run.id, run), false);
  assert.equal(state.acceptRun(scope, run.planId, run.id, { ...run, revision: 4 }), false);
  assert.equal(state.acceptRun(scope, run.planId, 'other-run', { ...run, id: 'other-run', revision: 0 }), true);
  const copy = state.run(run.planId, run.id); copy.notes = 'changed outside store';
  assert.equal(state.run(run.planId, run.id).notes, null);
  state.bind({ userId: 'b', incarnation: 'incarnation-b', epoch: 2 });
  assert.equal(state.run(run.planId, run.id), null);
  assert.equal(state.acceptRun(scope, run.planId, run.id, run), false);
});
test('bootstrap is explicit and empty; preference body retains exact contract and header', async () => {
  const requests = [];
  const client = ready(async (url, init) => { requests.push({ url, ...init }); return json({ success: true, data: {} }); });
  await client.bootstrap(fixture.bootstrap);
  assert.equal(requests[0].url.endsWith('/account/bootstrap'), true);
  assert.equal(requests[0].body, '{}');
  assert.equal(requests[0].headers.has('X-Account-Incarnation'), false);
  await client.preferences(fixture.preferences);
  assert.deepEqual(JSON.parse(requests[1].body), fixture.preferences);
  assert.equal(requests[1].headers.get('X-Account-Incarnation'), fixture.headers['X-Account-Incarnation']);
});

