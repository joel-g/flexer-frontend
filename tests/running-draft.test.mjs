import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { build } from 'esbuild';
import { emptyIntakeForm, intakeFromForm, IntakeValidationError, buildRunningPrompt } from '../src/running/intake.ts';
import { activationFromReview, activationReviewIdentity, OperationIdentity } from '../src/running/preview.ts';
import { runningFixtureApi } from './fixtures/running-api.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/running-contract.json', import.meta.url)));
const form = () => ({ ...emptyIntakeForm(), goalText: 'Build a consistent running habit', start: '2026-10-21', end: '2026-11-01', timeZone: 'America/New_York', datesConfirmed: true, liftingContextConfirmed: true });
const cache = new URL('../.running-cache/components/', import.meta.url);
mkdirSync(cache, { recursive: true });
await build({ entryPoints: ['src/running/IntakeForm.tsx', 'src/running/PromptReview.tsx', 'src/running/ImportPreview.tsx', 'src/running/RunningCard.tsx'], outdir: cache.pathname.replace(/^\/(.:)/, '$1'), bundle: true, platform: 'node', format: 'esm', packages: 'external', outExtension: { '.js': '.mjs' }, jsx: 'automatic', logLevel: 'silent' });
const { RunningIntakeForm } = await import(new URL('IntakeForm.mjs', cache));
const { RunningPromptReview } = await import(new URL('PromptReview.mjs', cache));
const { RunningImportPreview } = await import(new URL('ImportPreview.mjs', cache));
const { RunningCardView } = await import(new URL('RunningCard.mjs', cache));

test('running dashboard distinguishes loading, disabled, failure, absent and active without strength prerequisites', () => {
  const render = load => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(RunningCardView, { load, retry() {} })));
  assert.ok(render({ phase: 'loading', data: null, message: '' }).includes('Loading your running'));
  assert.ok(render({ phase: 'disabled', data: null, message: '' }).includes('Saved running data is retained'));
  assert.ok(render({ phase: 'error', data: null, message: 'Synthetic failure' }).includes('Retry running'));
  const empty = { enabled: true, account: null, activePlan: null, draftCount: 0 };
  assert.ok(render({ phase: 'ready', data: empty, message: '' }).includes('Start running'));
  assert.ok(render({ phase: 'ready', data: { ...empty, draftCount: 1 }, message: '' }).includes('Continue running draft'));
  const active = { ...empty, activePlan: { program: { name: 'Synthetic running plan' } } };
  assert.ok(render({ phase: 'ready', data: active, message: '' }).includes('Open running plan'));
  assert.equal(render({ phase: 'ready', data: active, message: '' }).includes('/onboarding'), false);
});

test('blank optional intake stays unknown while known zero remains zero', () => {
  const unknown = intakeFromForm(form());
  assert.equal(unknown.recentVolume, null); assert.equal(unknown.runsPerWeek, null); assert.equal(unknown.raceHistory, null); assert.equal(unknown.liftingDays, null);
  const known = intakeFromForm({ ...form(), recentDistance: '0', periodStart: '2026-10-07', periodEnd: '2026-10-20', runsPerWeek: '0', raceHistoryMode: 'none', availableDaysKnown: true, liftingDaysKnown: true });
  assert.equal(known.recentVolume.distance.value, 0); assert.equal(known.runsPerWeek, 0); assert.deepEqual(known.raceHistory, []); assert.deepEqual(known.availableDays, []); assert.deepEqual(known.liftingDays, []);
});
test('intake preserves all race, weekly, limitation and manually confirmed lifting fields', () => {
  const input = { ...form(), objective: 'finish_race', raceChoice: 'marathon', raceDate: '2026-11-01', runsPerWeek: '10', longestDistance: '13.1', longestDate: '2026-10-18', weeklyTotalsKnown: true, weeklyTotals: ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'].map((start, i) => ({ start, distance: i === 0 ? '' : String(i) })), raceHistoryMode: 'entries', raceHistory: [{ raceChoice: 'half_marathon', count: '11', periodMonths: '24', date: '', durationSeconds: '', notes: 'Synthetic aggregate history' }], interruptions: 'Synthetic break', limitations: 'Synthetic note', availableDaysKnown: true, availableDays: ['tuesday'], longRunDay: 'sunday', availableMinutesPerRun: '45', liftingDaysKnown: true, liftingDays: ['monday'], liftingPriority: 'balanced' };
  const result = intakeFromForm(input);
  assert.equal(result.runsPerWeek, 10); assert.equal(result.longestRun.distance.value, 13.1); assert.equal(result.lastFourWeeklyTotals[0].distance, null); assert.equal(result.raceHistory[0].count, 11); assert.equal(result.raceHistory[0].date, null); assert.equal(result.interruptions, input.interruptions); assert.equal(result.limitations, input.limitations); assert.deepEqual(result.availableDays, ['tuesday']); assert.equal(result.longRunDay, 'sunday'); assert.equal(result.availableMinutesPerRun, 45); assert.deepEqual(result.liftingDays, ['monday']); assert.equal(result.liftingPriority, 'balanced');
});
test('invalid dates, numeric overflow, nonconsecutive weeks and missing confirmations reject visibly', () => {
  const variants = [{ datesConfirmed: false }, { liftingContextConfirmed: false }, { start: '2026-02-30' }, { start: '0000-01-01' }, { timeZone: '+02:00' }, { longestDistance: '0' }, { recentDistance: 'Infinity', periodStart: '2026-10-01', periodEnd: '2026-10-20' }, { weeklyTotalsKnown: true, weeklyTotals: ['2026-09-28', '2026-10-05', '2026-10-19', '2026-10-26'].map(start => ({ start, distance: '0' })) }];
  for (const change of variants) assert.throws(() => intakeFromForm({ ...form(), ...change }), IntakeValidationError);
});
test('366-day leap range remains valid and year-long plan bounds are software limits', () => {
  assert.equal(intakeFromForm({ ...form(), start: '2012-01-01', end: '2012-12-31' }).end, '2012-12-31');
  assert.throws(() => intakeFromForm({ ...form(), start: '2012-01-01', end: '2013-01-01' }), IntakeValidationError);
});
test('BYOL prompt is explicit, canonical and excludes identity/full profile and unselected sensitive notes', () => {
  const intake = { ...fixture.intake, interruptions: 'PRIVATE_INTERRUPTION', limitations: 'PRIVATE_LIMITATION', email: 'private@example.invalid', profile: { medical: 'PRIVATE_PROFILE' } };
  const prompt = buildRunningPrompt(intake, false);
  for (const privateValue of ['PRIVATE_INTERRUPTION', 'PRIVATE_LIMITATION', 'private@example.invalid', 'PRIVATE_PROFILE']) assert.equal(prompt.includes(privateValue), false);
  for (const required of ['meters and seconds', 'requestedGoal', 'planGoal', 'Unknown (null) is not zero', 'unverified model text', '54 week entries', 'No automatic plan rewrite']) assert.equal(prompt.includes(required), true);
  assert.equal(buildRunningPrompt(intake, true).includes('PRIVATE_LIMITATION'), true);
});
test('operation IDs survive uncertain retry and change after payload edits without persisted fingerprints', () => {
  const operation = new OperationIdentity(); let counter = 0; const id = () => `synthetic-${++counter}`;
  assert.equal(operation.forPayload({ text: 'one', revision: 1 }, id), 'synthetic-1');
  assert.equal(operation.forPayload({ text: 'one', revision: 1 }, id), 'synthetic-1');
  assert.equal(operation.forPayload({ text: 'two', revision: 1 }, id), 'synthetic-2');
  operation.clear(); assert.equal(operation.forPayload({ text: 'two', revision: 1 }, id), 'synthetic-3');
});
test('activation requires connection, exact reviewed preview and every proposed change', async () => {
  const { api, account } = runningFixtureApi();
  const draft = (await api.createDraft({ intake: fixture.intake }, 'create')).data;
  const proposed = { ...fixture.import, planGoal: 'A different synthetic goal' };
  const imported = (await api.importPlan(draft.id, JSON.stringify(proposed), draft.revision, 'import')).data;
  const key = activationReviewIdentity(imported, account);
  assert.throws(() => activationFromReview(imported, account, key, new Set([0]), false), /Connect/);
  assert.throws(() => activationFromReview(imported, account, null, new Set([0]), true), /exact preview/);
  assert.throws(() => activationFromReview(imported, account, key, new Set(), true), /each proposed/);
  const payload = activationFromReview(imported, account, key, new Set([0]), true);
  assert.equal(payload.previewAcceptanceToken, imported.preview.previewAcceptanceToken);
  assert.equal(payload.expectedRevision, imported.revision); assert.equal(payload.expectedGeneration, account.generation);
  const newer = { ...imported, revision: imported.revision + 1 };
  assert.throws(() => activationFromReview(newer, account, key, new Set([0]), true), /exact preview/);
  assert.equal((await api.activate(imported.id, payload, 'activate')).data.lifecycle, 'active');
});
test('activation conflict current-account state cannot reuse consent to replace another plan', async () => {
  const { api, account } = runningFixtureApi();
  const draft = (await api.createDraft({ intake: fixture.intake }, 'create')).data;
  const imported = (await api.importPlan(draft.id, JSON.stringify(fixture.import), draft.revision, 'import')).data;
  const original = { ...account, activePlanId: 'running-plan-A' };
  const consent = activationReviewIdentity(imported, original);
  const accepted = new Set(imported.preview.differences.map((_difference, i) => i));
  assert.equal(activationFromReview(imported, original, consent, accepted, true).expectedActivePlanId, 'running-plan-A');
  for (const changed of [
    { ...original, generation: original.generation + 1, activePlanId: 'running-plan-B' },
    { ...original, generation: original.generation + 1 },
    { ...original, activePlanId: null },
    { ...original, incarnation: 'replacement-account-incarnation' },
  ]) {
    assert.notEqual(activationReviewIdentity(imported, changed), consent);
    assert.throws(() => activationFromReview(imported, changed, consent, accepted, true), /current running plan replacement/);
    const renewed = activationReviewIdentity(imported, changed);
    const payload = activationFromReview(imported, changed, renewed, accepted, true);
    assert.equal(payload.expectedActivePlanId, changed.activePlanId);
    assert.equal(payload.expectedGeneration, changed.generation);
  }
});
test('intake component renders all major field groups and no test-only personal example', () => {
  const html = renderToStaticMarkup(createElement(RunningIntakeForm, { onReview() {} }));
  for (const label of ['Goal and dates', 'Recent running', 'Race history', 'Context and availability', 'Confirm lifting context manually', 'Plan timezone', 'last four weekly totals']) assert.ok(html.includes(label));
  assert.equal(html.includes('first marathon in 8 weeks'), false);
  assert.equal(html.includes('<form'), true);
});
test('prompt component starts with sensitive-context opt-in unchecked and copy disabled', () => {
  const html = renderToStaticMarkup(createElement(RunningPromptReview, { intake: fixture.intake, onContinue() {}, onEdit() {} }));
  assert.ok(html.includes('Flexer makes no AI request')); assert.ok(html.includes('readOnly=""')); assert.ok(html.includes('disabled=""')); assert.equal(html.includes('checked=""'), false);
});
test('preview renders model text safely, shows both goals and blocks offline activation', async () => {
  const { api, account } = runningFixtureApi();
  const draft = (await api.createDraft({ intake: fixture.intake }, 'create')).data;
  const imported = (await api.importPlan(draft.id, JSON.stringify({ ...fixture.import, name: '<script>not executable</script>', planGoal: 'Different goal' }), draft.revision, 'import')).data;
  const html = renderToStaticMarkup(createElement(RunningImportPreview, { plan: imported, account, online: false, api, onPlan() {}, onActivated() {} }));
  assert.equal(html.includes('<script>not executable</script>'), false); assert.ok(html.includes('&lt;script&gt;'));
  for (const label of ['You are offline', 'Your original goal', 'Model echoed request', 'Proposed goal', 'I explicitly accept this change', 'Unverified model text', 'disabled=""']) assert.ok(html.includes(label));
});

