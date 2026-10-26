const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = path.resolve(__dirname, '../src/running/RunningHistory.tsx');
const fixtures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../running-contract/history-fixtures.json')));
function load(react = React) {
  const output = ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = new Module(source, module); mod.filename = source; mod.paths = module.paths;
  const original = mod.require.bind(mod); mod.require = name => name === 'react' ? react : original(name);
  mod._compile(output + '\nexports.historyWindowError = historyWindowError;', source); return mod.exports;
}
const ui = load();
test('movable window accepts historical/leap dates and rejects invalid/367-day ranges', () => {
  assert.equal(ui.historyWindowError('1900-01-01', '1900-01-31'), '');
  assert.equal(ui.historyWindowError('2012-01-01', '2012-12-31'), '');
  for (const pair of [['2012-01-01', '2013-01-01'], ['2026-02-29', '2026-03-01'], ['2026-11-01', '2026-10-01']]) assert.ok(ui.historyWindowError(...pair));
});
test('totals show timed-only pace coverage and separate distance/time targets', () => {
  const html = renderToStaticMarkup(React.createElement(ui.RunningTotals, { data: fixtures.analytics.data }));
  for (const text of ['6:15 /km', '2 of 3 runs', '4 km of 10 km', 'Planned distance targets', 'Planned time targets', 'no distance inferred', 'regardless of actual date', 'Plan-local dates']) assert.ok(html.includes(text), text);
  const empty = renderToStaticMarkup(React.createElement(ui.RunningTotals, { data: fixtures.emptyAnalytics.data })); assert.ok(empty.includes('no timed distance')); assert.ok(!empty.includes('NaN'));
});
test('mile preference converts display distance and pace without changing canonical data', () => {
  const before = JSON.stringify(fixtures.analytics.data);
  const html = renderToStaticMarkup(React.createElement(ui.RunningTotals, { data: fixtures.analytics.data, distanceUnit: 'mi' }));
  assert.ok(html.includes('6.21 mi')); assert.ok(html.includes('10:04 /mi')); assert.equal(JSON.stringify(fixtures.analytics.data), before);
  const items = renderToStaticMarkup(React.createElement(ui.RunningHistoryResults, { data: fixtures.first.data, distanceUnit: 'mi' })); assert.ok(items.includes(' mi')); assert.ok(!items.includes(' km'));
});
test('history renders date distinctions, duration derivation, escaped text and correction-only action', () => {
  const data = structuredClone(fixtures.first.data); data.items[0].title = '<img src=x onerror=alert(1)>'; data.items[0].result.notes = '<script>secret</script>'; data.items[1].result.durationSource = 'derived_from_pace';
  const html = renderToStaticMarkup(React.createElement(ui.RunningHistoryResults, { data, onCorrectResult() {} }));
  for (const text of ['Original date:', 'Scheduled date:', 'Actual date:', 'derived from entered pace', 'distance not prescribed', 'Correct result', 'Archived schedules stay frozen', '&lt;img', '&lt;script&gt;']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('<img')); assert.ok(!html.includes('<script>')); assert.ok(!html.includes('Reschedule'));
});
// Minimal deterministic hook runner exercises actual effect callbacks; it is not a browser or React scheduler proof.
function harness() {
  const slots = [], effects = []; let index = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(effect, deps) { const i = index++, previous = slots[i]; if (!previous || deps.some((v, j) => !Object.is(v, previous.deps[j]))) { slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = effect(); }); } },
  };
  const component = load(react).RunningHistory;
  return { render(props) { index = 0; const tree = component(props); while (effects.length) effects.shift()(); return tree; }, stop() { for (const slot of slots) slot?.cleanup?.(); } };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const props = api => ({ identityKey: 'account-a:epoch-1:incarnation-a', online: true, api, initialFrom: '2026-10-01', initialTo: '2026-11-01' });
test('account switch ignores late successful history and hides previous private data immediately', async () => {
  const h = harness(), history = deferred(), analytics = deferred();
  const api = { history: () => history.promise, analytics: () => analytics.promise }; const a = props(api);
  h.render(a); h.render({ ...a, identityKey: 'account-b:epoch-2:incarnation-b', online: false });
  history.resolve({ data: fixtures.first.data, status: 200 }); analytics.resolve({ data: fixtures.analytics.data, status: 200 }); await flush();
  const html = renderToStaticMarkup(h.render({ ...a, identityKey: 'account-b:epoch-2:incarnation-b', online: false })); assert.ok(!html.includes('Synthetic run')); assert.ok(html.includes('Connect to load')); h.stop();
});
test('generation mismatch never combines inconsistent totals and history', async () => {
  const h = harness(), api = { history: async () => ({ data: fixtures.first.data, status: 200 }), analytics: async () => ({ data: { ...fixtures.analytics.data, historyGeneration: 99 }, status: 200 }) }, p = props(api);
  h.render(p); await flush(); const html = renderToStaticMarkup(h.render(p)); assert.ok(html.includes('consistent snapshot')); assert.ok(!html.includes('Synthetic run')); h.stop();
});
test('feature-disabled error clears private rows and displays safe message instead of raw error', async () => {
  const h = harness(), api = { history: async () => { throw { code: 'FEATURE_DISABLED', message: 'RAW PRIVATE BODY' }; }, analytics: async () => ({ data: fixtures.analytics.data, status: 200 }) }, p = props(api);
  h.render(p); await flush(); const html = renderToStaticMarkup(h.render(p)); assert.ok(html.includes('currently unavailable')); assert.ok(!html.includes('RAW PRIVATE')); assert.ok(!html.includes('Synthetic run')); h.stop();
});
test('stale page cursor resets to first page instead of mixing generations', async () => {
  const h = harness(), calls = [], api = {
    history: async query => { calls.push(query); if (query.cursor) throw { code: 'HISTORY_CHANGED' }; return { data: fixtures.first.data, status: 200 }; },
    analytics: async () => ({ data: fixtures.analytics.data, status: 200 }),
  }, p = props(api);
  h.render(p); await flush(); const tree = h.render(p);
  function find(node) { if (!node || typeof node !== 'object') return null; if (node.type === 'button' && node.props.children === 'Next 20 runs') return node; for (const child of React.Children.toArray(node.props?.children)) { const found = find(child); if (found) return found; } return null; }
  const next = find(tree); assert.ok(next); next.props.onClick(); h.render(p); await flush(); h.render(p); await flush();
  assert.equal(calls.length, 3); assert.equal(calls[0].cursor, null); assert.ok(calls[1].cursor); assert.equal(calls[2].cursor, null); assert.ok(calls.every(x => x.limit === 20)); h.stop();
});
