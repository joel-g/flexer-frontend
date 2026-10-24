import { useEffect, useRef, useState } from 'react';
import type { RunningAnalyticsData, RunningAnalyticsQuery, RunningHistoryData, RunningHistoryItem, RunningHistoryQuery } from './contract.ts';

export interface RunningHistoryAdapter {
  history(query: RunningHistoryQuery): Promise<{ data: RunningHistoryData; status: number }>;
  analytics(query: RunningAnalyticsQuery): Promise<{ data: RunningAnalyticsData; status: number }>;
}
export interface RunningHistoryProps {
  identityKey: string;
  online: boolean;
  distanceUnit?: 'mi' | 'km';
  api: RunningHistoryAdapter;
  initialFrom: string;
  initialTo: string;
  planId?: string | null;
  onCorrectResult?: (item: RunningHistoryItem) => void;
}
function civilDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return NaN;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() / 86400000 : NaN;
}
function historyWindowError(from: string, to: string): string {
  const start = civilDay(from), end = civilDay(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Choose valid start and end dates.';
  if (end < start) return 'End date must be on or after start date.';
  if (end - start + 1 > 366) return 'Choose at most 366 days. You can move the window to any earlier dates.';
  return '';
}
const number = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
const formatDistance = (meters: number, unit: 'mi' | 'km') => `${number(meters / (unit === 'mi' ? 1609.344 : 1000))} ${unit}`;
function formatPace(seconds: number | null, unit: 'mi' | 'km'): string {
  if (seconds === null) return 'Not available: no timed distance';
  const rounded = Math.round(seconds * (unit === 'mi' ? 1.609344 : 1));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} /${unit}`;
}
export function RunningTotals({ data, distanceUnit = 'km' }: { data: RunningAnalyticsData; distanceUnit?: 'mi' | 'km' }) {
  const distance = (meters: number) => formatDistance(meters, distanceUnit);
  const pace = (seconds: number | null) => formatPace(seconds, distanceUnit);
  return <section aria-label="Running totals">
    <h2>Totals for {data.from} to {data.to}</h2>
    <p>Plan-local dates: each plan keeps its own timezone. Actual distance follows the date you ran; planned totals and adherence follow the current scheduled date.</p>
    <dl className="running-grid">
      <div><dt>Actual distance</dt><dd>{distance(data.actual.distanceMeters)} across {data.actual.completedRuns} completed runs</dd></div>
      <div><dt>Weighted pace, timed runs only</dt><dd>{pace(data.actual.weightedPaceSecondsPerKm)}</dd></div>
      <div><dt>Timed coverage</dt><dd>{data.actual.timedRuns} of {data.actual.completedRuns} runs; {distance(data.actual.timedDistanceMeters)} of {distance(data.actual.distanceMeters)}</dd></div>
      <div><dt>Recorded or pace-derived time</dt><dd>{number(data.actual.durationSeconds / 60)} minutes</dd></div>
      <div><dt>Planned distance targets</dt><dd>{distance(data.planned.distanceMeters)} across {data.planned.distanceRuns} runs</dd></div>
      <div><dt>Planned time targets</dt><dd>{number(data.planned.durationSeconds / 60)} minutes across {data.planned.durationRuns} runs; no distance inferred</dd></div>
    </dl>
    <p>Scheduled adherence: {data.adherence.completedRuns} completed, {data.adherence.skippedRuns} skipped, {data.adherence.pendingRuns} pending of {data.adherence.scheduledRuns} scheduled runs. Completed means current status for these scheduled dates, regardless of actual date.</p>
    <details><summary>Weekly totals</summary><ul className="running-preview-list">{data.weeks.map(week => <li key={week.start}>
      <h3>Week of {week.start}</h3><p>Actual: {distance(week.actual.distanceMeters)}. Timed coverage: {week.actual.timedRuns}/{week.actual.completedRuns} runs, {distance(week.actual.timedDistanceMeters)}/{distance(week.actual.distanceMeters)}. Weighted pace: {pace(week.actual.weightedPaceSecondsPerKm)}.</p>
      <p>Planned: {distance(week.planned.distanceMeters)} and {number(week.planned.durationSeconds / 60)} minutes in separate targets. Scheduled: {week.adherence.completedRuns} completed, {week.adherence.skippedRuns} skipped, {week.adherence.pendingRuns} pending.</p>
    </li>)}</ul></details>
  </section>;
}
export function RunningHistoryResults({ data, onCorrectResult, distanceUnit = 'km' }: { data: RunningHistoryData; distanceUnit?: 'mi' | 'km'; onCorrectResult?: (item: RunningHistoryItem) => void }) {
  const distance = (meters: number) => formatDistance(meters, distanceUnit);
  return <section aria-label="Run history results"><h2>{data.view === 'actual' ? 'Completed runs by actual date' : 'Runs by current scheduled date'}</h2>
    {!data.items.length && <p>No runs in this window.</p>}
    <ul className="running-preview-list">{data.items.map(item => <li key={item.runId}>
      <h3>{item.title}</h3><p>{item.planName} · {item.type} · {item.timeZone}</p>
      <p>Original date: {item.result.originalDate}. Scheduled date: {item.result.scheduledDate}. Actual date: {item.result.actualDate ?? 'Not logged'}.</p>
      <p>Target: {item.target.kind === 'distance' ? distance(item.target.meters) : `${number(item.target.seconds / 60)} minutes (distance not prescribed)`}. Status: {item.result.status}.</p>
      {item.result.actualMeters !== null && <p>Actual: {distance(item.result.actualMeters)}{item.result.durationSeconds !== null ? `; ${number(item.result.durationSeconds / 60)} minutes${item.result.durationSource === 'derived_from_pace' ? ' (derived from entered pace)' : ''}` : '; no time recorded'}.</p>}
      {item.result.effortRpe !== null && <p>Effort: {item.result.effortRpe}/10.</p>}
      {item.result.notes && <p className="running-review-copy">{item.result.notes}</p>}
      {onCorrectResult && <button type="button" onClick={() => onCorrectResult(item)}>Correct result</button>}
    </li>)}</ul>
    {onCorrectResult && <p>Result corrections are available for archived plans too. Archived schedules stay frozen.</p>}
  </section>;
}
/** Parent should additionally key this component by account + session epoch + incarnation. */
export function RunningHistory({ identityKey, online, distanceUnit = 'km', api, initialFrom, initialTo, planId = null, onCorrectResult }: RunningHistoryProps) {
  const [from, setFrom] = useState(initialFrom), [to, setTo] = useState(initialTo);
  const [query, setQuery] = useState({ from: initialFrom, to: initialTo, view: 'actual' as 'actual' | 'scheduled', cursor: null as string | null });
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState<{ identity: string; planId: string | null; cursor: string | null; history: RunningHistoryData; analytics: RunningAnalyticsData } | null>(null);
  const [message, setMessage] = useState(''), [loading, setLoading] = useState(false);
  const identity = useRef(identityKey); identity.current = identityKey;
  const sequence = useRef(0);
  useEffect(() => {
    const request = ++sequence.current, owner = identityKey;
    let cancelled = false;
    const current = () => !cancelled && sequence.current === request && identity.current === owner;
    setLoaded(null); setMessage(''); setLoading(false);
    const invalid = historyWindowError(query.from, query.to);
    if (invalid) { setMessage(invalid); return () => { cancelled = true; }; }
    if (!online || !identityKey) return () => { cancelled = true; };
    setLoading(true);
    void Promise.all([
      api.history({ ...query, planId, limit: 20 }),
      api.analytics({ from: query.from, to: query.to, planId }),
    ]).then(([history, analytics]) => {
      if (!current()) return;
      if (history.data.historyGeneration !== analytics.data.historyGeneration) {
        setLoaded(null); setMessage('History changed while loading. Refresh to read a consistent snapshot.');
        if (query.cursor !== null) setQuery(previous => ({ ...previous, cursor: null }));
        return;
      }
      setLoaded({ identity: owner, planId, cursor: query.cursor, history: history.data, analytics: analytics.data });
    }).catch((error: unknown) => {
      if (!current()) return;
      setLoaded(null);
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      setMessage(code === 'HISTORY_CHANGED' ? 'History changed. Pagination was reset; refresh if needed.' : code === 'FEATURE_DISABLED' ? 'Running history is currently unavailable.' : code === 'AUTH_REQUIRED' || code === 'ACCOUNT_REPLACED' ? 'Sign in to the same account before loading history.' : 'History could not be loaded. Retry when connected.');
      if (code === 'HISTORY_CHANGED' && query.cursor !== null) setQuery(previous => ({ ...previous, cursor: null }));
    }).finally(() => { if (current()) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, identityKey, online, planId, query, refresh]);
  const visible = loaded?.identity === identityKey && loaded.planId === planId && loaded.cursor === query.cursor && loaded.history.from === query.from && loaded.history.to === query.to && loaded.history.view === query.view && online ? loaded : null;
  return <section className="running-form" aria-label="Running history">
    <h1>Running history</h1><p>Choose any date window up to 366 days. Earlier history is not removed by this limit.</p>
    <form onSubmit={event => { event.preventDefault(); const invalid = historyWindowError(from, to); setMessage(invalid); if (!invalid) setQuery(previous => ({ ...previous, from, to, cursor: null })); }}>
      <div className="running-grid"><label className="running-field">From<input type="date" value={from} onChange={event => setFrom(event.target.value)} required /></label><label className="running-field">To<input type="date" value={to} onChange={event => setTo(event.target.value)} required /></label>
        <label className="running-field">History view<select value={query.view} onChange={event => setQuery(previous => ({ ...previous, view: event.target.value as 'actual' | 'scheduled', cursor: null }))}><option value="actual">Actual completion dates</option><option value="scheduled">Scheduled dates and adherence</option></select></label></div>
      <div className="running-actions"><button type="submit" disabled={!online || loading}>Show window</button><button type="button" disabled={!online || loading} onClick={() => { setQuery(previous => ({ ...previous, cursor: null })); setRefresh(value => value + 1); }}>Refresh from first page</button></div>
    </form>
    {!online && <p role="status">Connect to load history and totals. Offline run edits remain in the separate logging queue.</p>}
    {loading && <p role="status">Loading history…</p>}{message && <p role="alert" className="running-message">{message}</p>}
    {visible && <><RunningTotals data={visible.analytics} distanceUnit={distanceUnit} /><RunningHistoryResults data={visible.history} distanceUnit={distanceUnit} onCorrectResult={onCorrectResult} />
      {visible.history.nextCursor && <button type="button" disabled={loading || !online} onClick={() => setQuery(previous => ({ ...previous, cursor: visible.history.nextCursor }))}>Next 20 runs</button>}</>}
  </section>;
}
