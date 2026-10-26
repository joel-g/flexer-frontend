import type { RunningAnalyticsQuery, RunningHistoryQuery } from './contract.ts';
import { dayValue, mondayOf } from './calendar.ts';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const integer = (value: unknown): value is number => number(value) && Number.isSafeInteger(value);
const text = (value: unknown, max = 2000): value is string => typeof value === 'string' && value.length <= max;
const id = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const date = (value: unknown): value is string => { try { return typeof value === 'string' && Number.isFinite(dayValue(value)); } catch { return false; } };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b));
function actual(value: unknown): boolean {
  if (!object(value) || !integer(value.completedRuns) || !integer(value.timedRuns) || !number(value.distanceMeters) || !number(value.timedDistanceMeters) || !number(value.durationSeconds)) return false;
  if (value.timedRuns > value.completedRuns || value.timedDistanceMeters > value.distanceMeters) return false;
  return value.timedDistanceMeters === 0 ? value.weightedPaceSecondsPerKm === null && value.durationSeconds === 0 && value.timedRuns === 0 : number(value.weightedPaceSecondsPerKm) && value.weightedPaceSecondsPerKm > 0 && near(value.weightedPaceSecondsPerKm, value.durationSeconds / value.timedDistanceMeters * 1000);
}
function planned(value: unknown): boolean { return object(value) && integer(value.runs) && integer(value.distanceRuns) && integer(value.durationRuns) && value.runs === value.distanceRuns + value.durationRuns && number(value.distanceMeters) && number(value.durationSeconds); }
function adherence(value: unknown): boolean { return object(value) && integer(value.scheduledRuns) && integer(value.completedRuns) && integer(value.skippedRuns) && integer(value.pendingRuns) && value.scheduledRuns === value.completedRuns + value.skippedRuns + value.pendingRuns; }
function windowMatches(data: Record<string, unknown>, query: RunningAnalyticsQuery) { return data.from === query.from && data.to === query.to && data.planId === query.planId && integer(data.historyGeneration); }
export function validAnalytics(value: unknown, query: RunningAnalyticsQuery): boolean {
  if (!object(value) || !windowMatches(value, query) || value.dateBasis !== 'plan-local' || !actual(value.actual) || !planned(value.planned) || !adherence(value.adherence) || !Array.isArray(value.weeks) || value.weeks.length > 54) return false;
  let previous = '';
  return value.weeks.every(week => { if (!object(week) || !date(week.start) || mondayOf(week.start) !== week.start || week.start <= previous || week.start > query.to || dayValue(week.start) + 6 < dayValue(query.from) || !actual(week.actual) || !planned(week.planned) || !adherence(week.adherence)) return false; previous = week.start; return true; });
}
export function validHistory(value: unknown, query: RunningHistoryQuery): boolean {
  if (!object(value) || !windowMatches(value, query) || value.view !== query.view || !Array.isArray(value.items) || value.items.length > query.limit || !(value.nextCursor === null || text(value.nextCursor, 8192))) return false;
  const seen = new Set<string>();
  return value.items.every(item => {
    if (!object(item) || !id(item.planId) || !id(item.runId) || seen.has(item.runId) || !text(item.title) || !text(item.planName, 160) || !text(item.timeZone, 100) || !['easy', 'long', 'recovery', 'tempo', 'interval', 'run_walk', 'race', 'other'].includes(String(item.type))) return false;
    if (query.planId !== null && item.planId !== query.planId) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: item.timeZone }); } catch { return false; }
    seen.add(item.runId);
    const target = item.target, run = item.result;
    if (!object(target) || !(target.kind === 'distance' && number(target.meters) && target.meters > 0 && target.seconds === null || target.kind === 'duration' && number(target.seconds) && target.seconds > 0 && target.meters === null)) return false;
    if (!object(run) || run.id !== item.runId || run.planId !== item.planId || !integer(run.revision) || !date(run.originalDate) || !date(run.scheduledDate) || !(run.notes === null || text(run.notes)) || !(run.effortRpe === null || number(run.effortRpe) && run.effortRpe <= 10)) return false;
    if (run.status === 'completed') { if (!date(run.actualDate) || !number(run.actualMeters) || run.actualMeters <= 0 || !(run.durationSeconds === null ? run.durationSource === null : number(run.durationSeconds) && run.durationSeconds > 0 && ['entered', 'derived_from_pace'].includes(String(run.durationSource)))) return false; }
    else if (!['pending', 'skipped'].includes(String(run.status)) || run.actualDate !== null || run.actualMeters !== null || run.durationSeconds !== null || run.durationSource !== null || run.effortRpe !== null || run.status === 'pending' && run.notes !== null) return false;
    if (query.view === 'actual' && run.status !== 'completed') return false;
    const selected = query.view === 'actual' ? run.actualDate : run.scheduledDate;
    return date(selected) && selected >= query.from && selected <= query.to;
  });
}
