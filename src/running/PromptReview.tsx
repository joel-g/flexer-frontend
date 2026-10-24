import { useMemo, useState } from 'react';
import type { Intake } from './contract.ts';
import { buildRunningPrompt } from './intake.ts';

export function RunningPromptReview({ intake, onContinue, onEdit, busy = false, copyText = text => navigator.clipboard.writeText(text) }: { intake: Intake; onContinue: () => void; onEdit: () => void; busy?: boolean; copyText?: (text: string) => Promise<void> }) {
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [reviewedPrompt, setReviewedPrompt] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const prompt = useMemo(() => buildRunningPrompt(intake, includeSensitive), [intake, includeSensitive]);
  async function copy() {
    if (reviewedPrompt !== prompt) return;
    try { await copyText(prompt); setCopyStatus('Copied. Paste it into the LLM you choose; Flexer has not sent it anywhere.'); }
    catch { setCopyStatus('Clipboard access failed. Select and copy the reviewed prompt manually.'); }
  }
  return <section className="running-form"><header><p className="running-eyebrow">RUNNING / REVIEW CONTEXT</p><h1>Choose what you share</h1><p>Review the complete prompt below before copying it. Flexer makes no AI request. You decide where to paste it.</p></header><label><input type="checkbox" checked={includeSensitive} onChange={event => { setIncludeSensitive(event.target.checked); setCopyStatus(''); }} /> Include my interruption and limitation notes in the copied prompt</label><p>Goal and race-history notes may also contain personal information. Edit the intake if anything should be removed. Your chosen external LLM will receive only what you paste there.</p><label className="running-field">Prompt to review<textarea className="running-prompt" readOnly value={prompt} rows={22} /></label><label><input type="checkbox" checked={reviewedPrompt === prompt} onChange={event => setReviewedPrompt(event.target.checked ? prompt : null)} /> I reviewed this exact context and want to copy it.</label><div className="running-actions"><button type="button" disabled={reviewedPrompt !== prompt || busy} onClick={() => void copy()}>Copy reviewed prompt</button><button type="button" onClick={onEdit} disabled={busy}>Edit intake</button><button className="running-primary" type="button" onClick={onContinue} disabled={reviewedPrompt !== prompt || busy}>{busy ? 'Saving draft…' : 'Save draft and paste a plan'}</button></div><p role="status">{copyStatus}</p><p>Saving creates a Flexer draft with this intake. It does not contact an AI service or activate a training plan.</p></section>;
}
