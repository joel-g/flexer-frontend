import { useRef, useState, useSyncExternalStore } from 'react';
import type { CanonicalPlan, CanonicalProgram, CanonicalRun, ResultPut } from './contract.ts';
import type { QueueEntry } from './queue.ts';
import { useRunning } from './useRunning.ts';
import { dayValue, mondayOf, planToday } from './calendar.ts';
import { OperationIdentity } from './preview.ts';
type Prescription = CanonicalProgram['weeks'][number]['runs'][number];
const emptySync = { entries: [] as QueueEntry[], runs: {} as Record<string, CanonicalRun>, paused: true, error: '', retryAt: null };
const emptySubscribe = () => () => {};
export function RunChecklist({ plan }: { plan: CanonicalPlan }) {
  const { controller, client, online, recover } = useRunning();
  const sync = useSyncExternalStore(controller?.subscribe ?? emptySubscribe, controller?.snapshot ?? (() => emptySync));
  const [overrides, setOverrides] = useState<Record<string, CanonicalRun>>({});
  const [error, setError] = useState('');
  const groups = new Map<string, Prescription[]>();
  for (const week of plan.program?.weeks ?? []) for (const original of week.runs) {
    const schedule = overrides[original.id], saved = sync.runs[JSON.stringify([plan.id, original.id])];
    const override = schedule && (!saved || schedule.revision > saved.revision) ? schedule : saved;
    const run = override && override.revision > original.result.revision ? { ...original, result: override } : original;
    const monday = mondayOf(run.result.scheduledDate); groups.set(monday, [...groups.get(monday) ?? [], run]);
  }
  return <section className="running-form" aria-label="Weekly running checklist">
    <h2>{plan.program?.name}</h2><p>Dates use {plan.timeZone}. Runs stay where scheduled; there is no automatic catch-up.</p>
    {!online && <p role="status">Offline: logging is saved on this device. Rescheduling needs a connection.</p>}
    {!controller && <p role="alert">Safe offline storage is unavailable. Logging is disabled; your server data is unchanged.</p>}
    {sync.paused && controller && <div className="running-message"><p>Running edits are paused. Recover them only after signing in again and confirming this is your account. Recovery may send previously saved edits.</p><p>Session expiry or signout outside Flexer does not erase device edits. Use Flexer's Sign out action to clear them after its warning.</p><button disabled={!online} onClick={() => void recover().catch(cause => setError(cause instanceof Error ? cause.message : 'Recovery failed.'))}>Recover my pending edits</button></div>}
    {sync.error && <p role="alert">{sync.error}</p>}{error && <p role="alert">{error}</p>}
    {sync.entries.length > 0 && <p role="status">{sync.entries.length} edit(s) saved on this device, awaiting confirmation.{sync.retryAt && ' Automatic retry is waiting.'}</p>}
    {[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([week, runs]) => <section key={week}><h3>Week of {week}</h3>{runs.sort((a, b) => a.result.scheduledDate.localeCompare(b.result.scheduledDate) || a.id.localeCompare(b.id)).map(run => <RunEditor key={run.id} plan={plan} run={run} pending={sync.entries.filter(entry => entry.planId === plan.id && entry.runId === run.id)} paused={sync.paused} onSchedule={result => setOverrides(current => ({ ...current, [result.id]: result }))} />)}</section>)}
    {plan.program?.weeks.filter(week => !week.runs.length && !groups.has(week.start)).map(week => <p key={week.id}>Week of {week.start}: rest-only week.</p>)}
    {client && <p>Targets are the original prescription. Actual distance is recorded separately, including timed runs.</p>}
  </section>;
}
function RunEditor({ plan, run, pending, paused, onSchedule }: { plan: CanonicalPlan; run: Prescription; pending: QueueEntry[]; paused: boolean; onSchedule: (run: CanonicalRun) => void }) {
  const { controller, client, online, load } = useRunning();
  const units = load.data?.enabled ? load.data.account?.preferredUnits ?? 'km' : 'km';
  const result = run.result;
  const [editing, setEditing] = useState(false);
  const [actualDate, setActualDate] = useState(result.actualDate ?? planToday(plan.timeZone));
  const [distance, setDistance] = useState(result.actualMeters === null ? '' : String(result.actualMeters / (units === 'mi' ? 1609.344 : 1000)));
  const [minutes, setMinutes] = useState(result.durationSeconds === null ? '' : String(result.durationSeconds / 60));
  const [pace, setPace] = useState('');
  const [rpe, setRpe] = useState(result.effortRpe === null ? '' : String(result.effortRpe));
  const [notes, setNotes] = useState(result.notes ?? '');
  const [date, setDate] = useState(result.scheduledDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canonical, setCanonical] = useState<CanonicalRun | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const operation = useRef(new OperationIdentity());
  const blocked = pending[0]?.state === 'conflict' || pending[0]?.state === 'needs-correction';
  const latest = pending.at(-1);
  const factor = units === 'mi' ? 1609.344 : 1000;
  function openEditor(intent = latest?.payload) {
    const meters = intent?.actualDistance ? intent.actualDistance.value * ({ m: 1, km: 1000, mi: 1609.344 }[intent.actualDistance.unit]) : intent ? null : result.actualMeters;
    const seconds = intent ? intent.durationSeconds : result.durationSource === 'entered' ? result.durationSeconds : null;
    const paceSeconds = intent ? intent.paceSecondsPerKm : result.durationSource === 'derived_from_pace' && result.actualMeters && result.durationSeconds ? result.durationSeconds * 1000 / result.actualMeters : null;
    setActualDate((intent ? intent.actualDate : result.actualDate) ?? planToday(plan.timeZone)); setDistance(meters === null ? '' : String(meters / factor));
    setMinutes(seconds === null ? '' : String(seconds / 60)); setPace(paceSeconds == null ? '' : String(paceSeconds / 60 * factor / 1000));
    const effort = intent ? intent.effortRpe : result.effortRpe; setRpe(effort == null ? '' : String(effort)); setNotes((intent ? intent.notes : result.notes) ?? ''); setEditing(true);
  }
  async function save(status: ResultPut['status']) {
    if (!controller || paused || busy) return;
    setBusy(true); setError('');
    try {
      if (status === 'completed' && (dayValue(actualDate) > dayValue(planToday(plan.timeZone)))) throw new Error('Actual completion cannot be in the future in this plan timezone.');
      if (minutes && pace) throw new Error('Enter duration or pace, not both.');
      if (blocked && (!reviewed || !canonical)) throw new Error('Reload and explicitly review the current server result first.');
      const payload: ResultPut = { mutationId: crypto.randomUUID(), expectedRevision: blocked ? canonical!.revision : latest ? latest.payload.expectedRevision + 1 : result.revision, status,
        actualDate: status === 'completed' ? actualDate : null, actualDistance: status === 'completed' ? { value: Number(distance), unit: units } : null,
        durationSeconds: status === 'completed' && minutes ? Number(minutes) * 60 : null, paceSecondsPerKm: status === 'completed' && pace ? Number(pace) * 60 / (units === 'mi' ? 1.609344 : 1) : null,
        effortRpe: status === 'completed' && rpe ? Number(rpe) : null, notes: status === 'pending' ? null : notes || null };
      await controller.save(plan.id, run.id, payload, blocked); setEditing(false); setReviewed(false); setCanonical(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Run was not saved.'); } finally { setBusy(false); }
  }
  async function reconcile() {
    if (!client || !online) return;
    try { const response = await client.plan(plan.id); const fresh = response.data.program?.weeks.flatMap(week => week.runs).find(item => item.id === run.id)?.result; if (!fresh) throw new Error('This run is no longer available.'); setCanonical(fresh); setReviewed(false); openEditor(pending[0]?.payload); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load current result.'); }
  }
  async function reschedule() {
    if (!client || !online || busy || paused || pending.length || result.status !== 'pending' || plan.lifecycle !== 'active') return;
    setBusy(true); setError('');
    try { dayValue(date); if (!plan.program || date < plan.program.start || date > plan.program.end) throw new Error('Choose a date inside this plan.'); const body = { expectedRevision: result.revision, date }; const mutationId = operation.current.forPayload(body); const response = await client.schedule(plan.id, run.id, { ...body, mutationId }); onSchedule(response.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Reschedule failed.'); } finally { setBusy(false); }
  }
  return <article className="running-run-card"><h4>{result.scheduledDate} · {run.title}</h4><p>{run.type} · {run.target.kind === 'distance' ? `${(run.target.meters / factor).toFixed(2)} ${units} planned` : `${run.target.seconds / 60} minutes planned`} · {run.effort}</p><p>{run.notes}</p><p>Original date: {run.originalDate}. Status: {latest ? `${latest.payload.status} — awaiting sync` : result.status}.</p>{result.actualMeters !== null && <p>Actual: {(result.actualMeters / factor).toFixed(2)} {units} on {result.actualDate}{result.durationSeconds !== null && ` · ${(result.durationSeconds / 60).toFixed(1)} minutes (${result.durationSource === 'derived_from_pace' ? 'derived from pace' : 'entered'})`}.</p>}
    {pending.length > 0 && <p role="status">Sync: {pending[0].state}. {pending.length} pending edit(s).</p>}{blocked && <button disabled={!online || busy} onClick={() => void reconcile()}>Review current server result</button>}
    {canonical && <div className="running-message"><p>Current server result: {canonical.status}, actual date {canonical.actualDate ?? 'none'}, distance {canonical.actualMeters ?? 'none'} meters.</p><label><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I reviewed this result and want my corrected edit applied. Any later unsent edits will follow it in order.</label></div>}
    <div className="running-actions"><button disabled={paused || busy || !controller} onClick={() => editing ? setEditing(false) : openEditor()}>{editing ? 'Close editor' : result.status === 'completed' ? 'Edit run log' : 'Log run'}</button><button disabled={paused || busy || !controller || blocked && !reviewed} onClick={() => void save('skipped')}>Skip</button><button disabled={paused || busy || !controller || blocked && !reviewed} onClick={() => void save('pending')}>Undo to pending</button></div>
    {editing && <div className="running-grid"><label className="running-field">Actual local date<input type="date" value={actualDate} max={planToday(plan.timeZone)} onChange={event => setActualDate(event.target.value)} /></label><label className="running-field">Actual distance ({units})<input type="number" min="0" step="any" value={distance} onChange={event => setDistance(event.target.value)} /></label><label className="running-field">Duration (minutes, optional)<input type="number" min="0" step="any" value={minutes} onChange={event => setMinutes(event.target.value)} /></label><label className="running-field">Pace (minutes/{units}, optional)<input type="number" min="0" step="any" value={pace} onChange={event => setPace(event.target.value)} /></label><label className="running-field">Effort RPE (0–10, optional)<input type="number" min="0" max="10" step="any" value={rpe} onChange={event => setRpe(event.target.value)} /></label><label className="running-field">Notes<textarea maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label><button disabled={paused || busy || blocked && !reviewed} onClick={() => void save('completed')}>Save run on this device</button></div>}
    {plan.lifecycle === 'active' && result.status === 'pending' && <div className="running-actions"><label className="running-field">Reschedule within plan<input type="date" min={plan.program?.start} max={plan.program?.end} value={date} onChange={event => setDate(event.target.value)} /></label><button disabled={!online || paused || busy || pending.length > 0} onClick={() => void reschedule()}>Reschedule</button></div>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
