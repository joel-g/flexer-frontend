import { useEffect, useRef, useState } from 'react';
import type { Archive, CanonicalPlan } from './contract.ts';

export type RunningPlanAction = 'archive' | 'delete';
export interface RunningPlanActionsAdapter {
  archive(planId: string, body: Archive, operationId: string): Promise<{ data: CanonicalPlan; status: number }>;
  deletePlan(planId: string, revision: number): Promise<{ data: { deleted: true }; status: number }>;
}
export interface RunningPlanActionsProps {
  identityKey: string;
  plan: Pick<CanonicalPlan, 'id' | 'revision' | 'lifecycle'>;
  generation: number;
  online: boolean;
  enabled: boolean;
  pendingEdits: boolean;
  api: RunningPlanActionsAdapter;
  beforeAction: (action: RunningPlanAction, planId: string) => Promise<void>;
  afterArchive: (plan: CanonicalPlan) => Promise<void>;
  afterDelete: (planId: string) => Promise<void>;
}
/** Parent keys by authenticated identity/session/incarnation; callbacks own scoped queue/cache lifecycle. */
export function RunningPlanActions(props: RunningPlanActionsProps) {
  const { identityKey, plan, generation, online, enabled, pendingEdits, api, beforeAction, afterArchive, afterDelete } = props;
  const scope = JSON.stringify([identityKey, plan.id, plan.revision, generation, pendingEdits, online, enabled]);
  const current = useRef(scope); current.current = scope;
  const ownerScope = JSON.stringify([identityKey, plan.id]);
  const currentOwner = useRef(ownerScope); currentOwner.current = ownerScope;
  const [confirmation, setConfirmation] = useState<{ action: RunningPlanAction; scope: string; checked: boolean } | null>(null);
  const [message, setMessage] = useState<{ scope: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const archiveOperation = useRef<{ payload: string; id: string } | null>(null);
  const [completed, setCompleted] = useState<{ identity: string; planId: string; action: RunningPlanAction; cleanupFailed: boolean; archivedPlan?: CanonicalPlan } | null>(null);
  const mounted = useRef(false);
  const lifetimeEpoch = useRef(0);
  useEffect(() => {
    mounted.current = true; const epoch = ++lifetimeEpoch.current;
    return () => { mounted.current = false; lifetimeEpoch.current = epoch + 1; };
  }, []);
  const outcome = completed?.identity === identityKey && completed.planId === plan.id ? completed : null;
  const reviewed = confirmation?.scope === scope ? confirmation : null;
  async function cleanupOnly() {
    if (!mounted.current || !outcome || !outcome.cleanupFailed || inFlight.current) return;
    const epoch = lifetimeEpoch.current;
    const live = () => mounted.current && lifetimeEpoch.current === epoch;
    const owner = identityKey, id = plan.id; inFlight.current = true; setBusy(true);
    try {
      if (outcome.action === 'delete') await afterDelete(id); else if (outcome.archivedPlan) await afterArchive(outcome.archivedPlan);
      if (live() && currentOwner.current === ownerScope) setCompleted({ ...outcome, cleanupFailed: false });
    } catch {
      if (live() && current.current === scope) setMessage({ scope, text: `The server action is complete. Local cleanup still needs attention for this ${owner ? 'account' : 'session'}.` });
    } finally { inFlight.current = false; if (live() && currentOwner.current === ownerScope) setBusy(false); }
  }
  async function perform() {
    if (!mounted.current || !reviewed?.checked || !online || !enabled || outcome || inFlight.current || !identityKey) return;
    const epoch = lifetimeEpoch.current;
    const live = () => mounted.current && lifetimeEpoch.current === epoch;
    const expectedScope = scope, owner = identityKey, id = plan.id, action = reviewed.action;
    const body: Archive = { expectedRevision: plan.revision, expectedGeneration: generation };
    inFlight.current = true; setBusy(true); setMessage(null);
    try {
      await beforeAction(action, id);
      if (!live() || current.current !== expectedScope) return;
      let archivedPlan: CanonicalPlan | undefined;
      if (action === 'archive') {
        const payload = JSON.stringify([owner, id, body]);
        if (archiveOperation.current?.payload !== payload) archiveOperation.current = { payload, id: crypto.randomUUID() };
        archivedPlan = (await api.archive(id, body, archiveOperation.current.id)).data;
        if (archivedPlan.id !== id || archivedPlan.lifecycle !== 'archived') throw new Error('Invalid archive acknowledgment');
      } else {
        const response = await api.deletePlan(id, plan.revision);
        if (response.data.deleted !== true) throw new Error('Invalid delete acknowledgment');
      }
      if (!live() || currentOwner.current !== ownerScope) return;
      // Server success is recorded before local cleanup; never report rollback if cleanup throws.
      const result = { identity: owner, planId: id, action, cleanupFailed: false, archivedPlan };
      setCompleted(result); setConfirmation(null);
      try {
        if (action === 'delete') await afterDelete(id); else await afterArchive(archivedPlan!);
      } catch {
        if (live() && currentOwner.current === ownerScope) setCompleted({ ...result, cleanupFailed: true });
      }
    } catch (error: unknown) {
      if (!live() || current.current !== expectedScope) return;
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      setMessage({ scope, text: code === 'REVISION_CONFLICT' || code === 'STALE_OPERATION' ? 'This plan changed. Reload and confirm the current version before trying again.' : code === 'FEATURE_DISABLED' ? 'Running actions are currently unavailable.' : 'The action was not confirmed. Keep edits paused and retry or reload before assuming it completed.' });
      if (code === 'REVISION_CONFLICT' || code === 'STALE_OPERATION') setConfirmation(null);
    } finally { inFlight.current = false; if (live() && currentOwner.current === ownerScope) setBusy(false); }
  }
  if (!enabled) return <p role="status">Running plan actions are currently unavailable. Account data cleanup remains available in Profile.</p>;
  if (outcome) return <section className="running-form" aria-label="Plan action result">
    <p role="status">{outcome.action === 'delete' ? 'This running plan was deleted on the server. This cannot be undone here.' : 'This running plan was archived on the server. Its history remains available.'}</p>
    {outcome.cleanupFailed ? <><p role="alert">Local cleanup did not finish. Device copies or pending edits may remain; keep this plan’s edits paused. The server action has not been undone.</p><button type="button" disabled={busy} onClick={() => void cleanupOnly()}>Retry local cleanup only</button></> : <p>Local cleanup completed.</p>}
    {message?.scope === scope && <p role="alert">{message.text}</p>}
  </section>;
  return <section className="running-form" aria-label="Running plan actions">
    <h2>Manage this running plan</h2>
    {!online && <p role="status">Connect before archiving or deleting a plan.</p>}
    {pendingEdits && <p role="alert">This plan has pending edits on this device. Archiving or deleting may conflict with unsaved changes. Review them before continuing.</p>}
    <div className="running-actions">{plan.lifecycle !== 'archived' && <button type="button" disabled={!online || busy || !identityKey} onClick={() => setConfirmation({ action: 'archive', scope, checked: false })}>Archive this plan</button>}
      <button type="button" disabled={!online || busy || !identityKey} onClick={() => setConfirmation({ action: 'delete', scope, checked: false })}>Delete this plan</button></div>
    {reviewed && <fieldset disabled={busy}><legend>Confirm {reviewed.action === 'archive' ? 'archive' : 'deletion'}</legend>
      <p>{reviewed.action === 'archive' ? 'Archive only this running plan. It stops being active; past results remain available for correction. Archived schedules cannot be changed.' : 'Permanently delete only this running plan and its running results. Other plans, strength workouts and your account are untouched. This does not delete your Clerk identity.'}</p>
      {pendingEdits && <p>Continuing pauses this plan’s pending edits. Deletion removes them during local cleanup; archiving requires review before any retry.</p>}
      <label><input type="checkbox" checked={reviewed.checked} onChange={event => setConfirmation({ ...reviewed, checked: event.target.checked })} />I understand and confirm this action for the current plan{pendingEdits ? ', including the pending-edit warning' : ''}.</label>
      <div className="running-actions"><button type="button" disabled={!reviewed.checked || !online || busy} onClick={() => void perform()}>Confirm {reviewed.action === 'archive' ? 'archive' : 'delete'}</button><button type="button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button></div>
    </fieldset>}
    {busy && <p role="status">Completing plan action…</p>}{message?.scope === scope && <p role="alert" className="running-message">{message.text}</p>}
  </section>;
}
