import { useEffect, useRef, useState } from 'react';
import type { AccountState, CanonicalPlan, FieldError } from './contract.ts';
import { RunningApiError } from './client.ts';
import type { RunningClient } from './client.ts';
import { activationFromReview, activationReviewIdentity, OperationIdentity } from './preview.ts';

export type DraftApi = Pick<RunningClient, 'createDraft' | 'importPlan' | 'activate' | 'plan'>;
export function RunningImportPreview({ plan, account, online, api, onPlan, onAccount, onActivated }: { plan: CanonicalPlan; account: AccountState; online: boolean; api: DraftApi; onPlan: (plan: CanonicalPlan) => void; onAccount?: (account: AccountState) => void; onActivated: (plan: CanonicalPlan) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [reviewed, setReviewed] = useState<string | null>(null);
  const [acceptance, setAcceptance] = useState<{ key: string; indices: number[] }>({ key: '', indices: [] });
  const importOperation = useRef(new OperationIdentity());
  const activationOperation = useRef(new OperationIdentity());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const key = activationReviewIdentity(plan, account);
  const accepted = new Set(acceptance.key === key ? acceptance.indices : []);
  const ready = online && !busy && reviewed === key && !!plan.preview && plan.preview.differences.every((_value, i) => accepted.has(i));
  function failure(error: unknown) {
    if (!mounted.current) return;
    setMessage(error instanceof Error ? error.message : 'The request was not saved. Your pasted plan is still here.');
    setFieldErrors(error instanceof RunningApiError ? error.fieldErrors : []);
    if (error instanceof RunningApiError && (error.status === 409 || error.current?.account)) {
      setReviewed(null); setAcceptance({ key: '', indices: [] });
      setMessage('Your running plan state changed. Reload the current draft and review its preview and replacement again before activating.');
      if (error.current?.account) onAccount?.(error.current.account);
    }
    // A conflict never activates or silently replaces the visible draft. Reload is explicit.
  }
  async function importText() {
    if (!online || busy) return;
    if (!text.trim()) { setMessage('Paste the JSON returned by your chosen LLM.'); return; }
    if (new TextEncoder().encode(text).length > 1048576) { setMessage('The pasted plan exceeds the 1MiB software limit.'); return; }
    setBusy(true); setMessage(''); setFieldErrors([]);
    const id = importOperation.current.forPayload({ planId: plan.id, revision: plan.revision, text });
    try {
      const response = await api.importPlan(plan.id, text, plan.revision, id);
      if (!mounted.current) return;
      if (response.data.id !== plan.id || response.data.lifecycle !== 'draft' || !response.data.preview || response.data.latestImportVersion !== response.data.preview.importVersion) throw new Error('The server did not return a valid preview. Keep the pasted plan and retry.');
      onPlan(response.data); setReviewed(null); setAcceptance({ key: '', indices: [] });
      setMessage('Import saved as a draft. Review every proposed change before activation.');
    } catch (error) { failure(error); } finally { if (mounted.current) setBusy(false); }
  }
  async function activate() {
    if (!ready) return;
    setBusy(true); setMessage(''); setFieldErrors([]);
    try {
      const payload = activationFromReview(plan, account, reviewed, accepted, online);
      const id = activationOperation.current.forPayload({ planId: plan.id, ...payload });
      const response = await api.activate(plan.id, payload, id);
      if (!mounted.current) return;
      if (response.data.id !== plan.id || response.data.lifecycle !== 'active' || response.data.activatedVersion !== payload.importVersion || !response.data.program) throw new Error('Activation was not acknowledged. Retry this same action to reconcile its outcome.');
      onActivated(response.data);
    } catch (error) { failure(error); } finally { if (mounted.current) setBusy(false); }
  }
  async function reload() {
    if (!online || busy) return;
    setBusy(true);
    try { const response = await api.plan(plan.id); if (mounted.current) { onPlan(response.data); setReviewed(null); setAcceptance({ key: '', indices: [] }); setMessage('Current draft loaded. Review it again before activation.'); } }
    catch (error) { failure(error); } finally { if (mounted.current) setBusy(false); }
  }
  return <section className="running-form"><header><p className="running-eyebrow">RUNNING / IMPORT AND REVIEW</p><h1>Make the plan yours</h1><p>Draft revision {plan.revision}. Importing does not activate it or replace your current running plan.</p></header>
    {!online && <p role="status" className="running-message">You are offline. Import, activation and draft refresh require a connection. Keep your pasted text here.</p>}
    <label className="running-field">Paste the plan JSON<textarea rows={10} value={text} onChange={event => setText(event.target.value)} disabled={busy} spellCheck={false} /></label><small>Raw JSON or one enclosing JSON fence only. No owner IDs, internal IDs, statuses or logs.</small>
    <div className="running-actions"><button type="button" disabled={!online || busy || !text.trim()} onClick={() => void importText()}>{busy ? 'Working…' : 'Validate and save preview'}</button><button type="button" disabled={!online || busy} onClick={() => void reload()}>Reload current draft</button></div>
    {message && <p role="status" className="running-message">{message}</p>}{fieldErrors.length > 0 && <ul role="alert">{fieldErrors.map((error, i) => <li key={`${error.path}:${i}`}><code>{error.path}</code>: {error.message}</li>)}</ul>}
    {plan.preview && <><header><h2>{plan.preview.plan.name}</h2><p>{plan.preview.plan.start} — {plan.preview.plan.end} · {plan.timeZone}</p></header><section aria-label="Goal and date review"><h2>Requested and proposed</h2><p><strong>Your original goal:</strong> {plan.intake.goalText}</p><p><strong>Model echoed request:</strong> {plan.preview.plan.requestedGoal}</p><p><strong>Proposed goal:</strong> {plan.preview.plan.planGoal}</p>{plan.preview.differences.length ? plan.preview.differences.map((difference, index) => <label className="running-field" key={`${key}:${index}`}><span>{difference.field}: requested {difference.requested ?? 'none'} → proposed {difference.proposed ?? 'none'}</span><span><input type="checkbox" checked={accepted.has(index)} onChange={event => { const next = new Set(accepted); if (event.target.checked) next.add(index); else next.delete(index); setAcceptance({ key, indices: [...next] }); }} /> I explicitly accept this change.</span></label>) : <p>No goal/date changes proposed. Review the plan itself before accepting.</p>}</section>
      <section aria-label="Unverified model text"><h2>Unverified model text</h2><p>Flexer validates structure, not training suitability.</p><p className="running-review-copy">{plan.preview.plan.rationale}</p><h3>Assumptions</h3><ul>{plan.preview.plan.assumptions.map((value, i) => <li key={i}>{value}</li>)}</ul><h3>Cautions</h3><ul>{plan.preview.plan.cautions.map((value, i) => <li key={i}>{value}</li>)}</ul></section>
      <section aria-label="Plan preview">{plan.preview.plan.weeks.map(week => <section key={week.start}><h3>Week of {week.start}</h3><p>{week.focus}</p><p>{week.notes}</p>{week.runs.length ? <ul className="running-preview-list">{week.runs.map(run => <li key={run.date}><strong>{run.date} · {run.title}</strong><p>{run.type} · {run.target.value} {run.target.unit} · {run.effort}</p>{run.paceRange && <p>Suggested pace: {run.paceRange.minSecondsPerKm}–{run.paceRange.maxSecondsPerKm} seconds/km</p>}<p>{run.notes}</p></li>)}</ul> : <p>Rest-only week</p>}</section>)}</section>
      <label><input type="checkbox" checked={reviewed === key} onChange={event => setReviewed(event.target.checked ? key : null)} /> I reviewed this exact plan preview and its unverified model text{account.activePlanId ? ', and accept replacing my current running plan' : ', with no current running plan to replace'}.</label>
      {account.activePlanId && <p>Activation will archive your current running plan. Your strength plan is independent and stays active.</p>}
      <button className="running-primary" type="button" disabled={!ready} onClick={() => void activate()}>Activate reviewed running plan</button>
    </>}
  </section>;
}
