import { useEffect, useRef, useState } from 'react';
import type { AccountState, CanonicalPlan, Intake } from './contract.ts';
import { RunningIntakeForm } from './IntakeForm.tsx';
import { RunningPromptReview } from './PromptReview.tsx';
import { RunningImportPreview } from './ImportPreview.tsx';
import type { DraftApi } from './ImportPreview.tsx';
import { OperationIdentity } from './preview.ts';
import './running.css';

/** Mount keyed by account+incarnation at integration. No bootstrap or provider calls occur here. */
export function RunningDraftFlow({ account, online, api, onAccount, onActivated }: { account: AccountState; online: boolean; api: DraftApi; onAccount?: (account: AccountState) => void; onActivated: (plan: CanonicalPlan) => void }) {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [draft, setDraft] = useState<CanonicalPlan | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(new OperationIdentity());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function createDraft() {
    if (!intake || busy) return;
    if (!online) { setError('Connect to save a draft. Your reviewed context remains here.'); return; }
    setBusy(true); setError('');
    try {
      const payload = { intake };
      const response = await api.createDraft(payload, operation.current.forPayload(payload));
      if (!mounted.current) return;
      if (!response.data.id || response.data.lifecycle !== 'draft') throw new Error('Draft creation was not acknowledged. Retry to reconcile its outcome.');
      setDraft(response.data);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Draft creation failed. Your context remains here.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <div>{!draft && <><div hidden={reviewing}><RunningIntakeForm onReview={value => { setIntake(value); setReviewing(true); setError(''); }} /></div>{reviewing && intake && <RunningPromptReview intake={intake} busy={busy} onContinue={() => void createDraft()} onEdit={() => { setReviewing(false); setError(''); }} />}{error && <p role="alert" className="running-message">{error}</p>}</>}{draft && <RunningImportPreview key={`${account.incarnation}:${draft.id}`} plan={draft} account={account} online={online} api={api} onPlan={setDraft} onAccount={onAccount} onActivated={onActivated} />}</div>;
}
