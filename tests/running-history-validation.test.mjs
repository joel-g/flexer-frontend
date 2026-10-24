import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validHistory, validAnalytics } from '../src/running/historyValidation.ts';
const fixture = JSON.parse(readFileSync(new URL('../../running-contract/history-fixtures.json', import.meta.url)));
const search = new URLSearchParams(fixture.query);
fixture.query = { view: 'actual', from: search.get('from'), to: search.get('to'), planId: null, limit: Number(search.get('limit')), cursor: null };
const analyticsSearch = new URLSearchParams(fixture.analyticsQuery);
fixture.analyticsQuery = { from: analyticsSearch.get('from'), to: analyticsSearch.get('to'), planId: null };
test('frozen history and analytics response fixtures pass runtime validation', () => {
  assert.equal(validHistory(fixture.first.data, fixture.query), true);
  assert.equal(validAnalytics(fixture.analytics.data, fixture.analyticsQuery), true);
});
test('history rejects malformed, foreign-plan, wrong-window and unsafe canonical values', () => {
  assert.equal(validHistory({}, fixture.query), false);
  for (const mutate of [data => { data.from = '1900-01-01'; }, data => { data.items[0].result.actualMeters = -1; }, data => { data.items[0].result.id = 'wrong'; }, data => { data.items[0].target.kind = 'fabricated'; }, data => { data.items.push(data.items[0]); }]) {
    const value = structuredClone(fixture.first.data); mutate(value); assert.equal(validHistory(value, fixture.query), false);
  }
});
test('analytics rejects misleading timed pace, coverage and target/adherence counts', () => {
  for (const mutate of [data => { data.actual.weightedPaceSecondsPerKm = 1; }, data => { data.actual.timedRuns = data.actual.completedRuns + 1; }, data => { data.planned.runs++; }, data => { data.adherence.scheduledRuns++; }, data => { data.dateBasis = 'UTC'; }]) { const value = structuredClone(fixture.analytics.data); mutate(value); assert.equal(validAnalytics(value, fixture.analyticsQuery), false); }
});
