import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { RunningClient } from '../src/running/client.ts';
import { RunningController } from '../src/running/controller.ts';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/running-contract.json', import.meta.url)));
function harness() {
  const source = readFileSync(new URL('./ui/fixture.tsx', import.meta.url), 'utf8');
  const selected = source.slice(source.indexOf('const key ='), source.indexOf('function Harness()'));
  assert(selected.includes('window.fetch ='));
  const code = ts.transpileModule(selected, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const mock = new Function('fixtures', 'window', 'localStorage', 'location', `let online=true,nextFailure='';const worker=null,workerBase=null;${code};return {fetch:window.fetch,initial,state,setFailure:value=>nextFailure=value};`)(fixtures, {}, storage, { href: 'http://fixture.invalid/' });
  const client = new RunningClient('http://fixture.invalid', mock.fetch);
  client.setIdentity('synthetic-A', async () => 'synthetic-token-synthetic-A');
  client.bindIncarnation(client.scope(), fixtures.headers['X-Account-Incarnation']);
  return { mock, client, values, storage };
}
test('mock gives active and draft distinct IDs and reads both exact resources', async () => {
  const h = harness(), initial = h.mock.initial();
  assert.notEqual(initial.active.id, initial.draft.id);
  assert((await h.client.plan(initial.active.id)).data.program);
  assert.equal((await h.client.plan(initial.draft.id)).data.program, null);
  await assert.rejects(h.client.plan('50000000-0000-4000-8000-000000000099'), error => error.status === 404);
});
test('legacy mock ID collision still returns the active canonical runs for conflict review', async () => {
  const h = harness(), stored = h.mock.initial(); stored.draft.id = stored.active.id;
  h.storage.setItem('flexer:synthetic-fixture:synthetic-A', JSON.stringify(stored));
  assert((await h.client.plan(stored.active.id)).data.program.weeks.flatMap(week => week.runs).length > 0);
});
test('mock conflict Undo can reload current server result and reconcile its durable queue', async () => {
  const h = harness(), plan = (await h.client.state()).data.activePlan;
  const run = plan.program.weeks.flatMap(week => week.runs).find(run => run.target.kind === 'duration');
  const controller = new RunningController({ account: { userId: 'synthetic-A', incarnation: fixtures.headers['X-Account-Incarnation'] }, storage: h.storage, locks: { exclusive: async (_name, action) => action() }, client: h.client, onRun() {} });
  const pending = revision => ({ mutationId: crypto.randomUUID(), expectedRevision: revision, status: 'pending', actualDate: null, actualDistance: null, durationSeconds: null, paceSecondsPerKm: null, effortRpe: null, notes: null });
  const settle = async () => { for (let i=0;i<12;i++) await new Promise(resolve => setImmediate(resolve)); };
  try {
    await controller.initialize(); h.mock.setFailure('conflict'); await controller.save(plan.id, run.id, pending(run.result.revision)); await settle();
    assert.equal(controller.snapshot().entries[0].state, 'conflict');
    const fresh = (await h.client.plan(plan.id)).data.program.weeks.flatMap(week => week.runs).find(item => item.id === run.id).result;
    assert.equal(fresh.revision, 1);
    await controller.save(plan.id, run.id, pending(fresh.revision), true); await settle();
    assert.deepEqual(controller.snapshot().entries, []);
    const saved = (await h.client.plan(plan.id)).data.program.weeks.flatMap(week => week.runs).find(item => item.id === run.id).result;
    assert.equal(saved.status, 'pending'); assert.equal(saved.revision, 2);
  } finally { controller.dispose(); }
});
