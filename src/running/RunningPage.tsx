import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ResponsiveLayout } from '../components/ResponsiveLayout';
import type { CanonicalPlan, PlanListData } from './contract.ts';
import { useRunning } from './useRunning.ts';
import { RunningCardView } from './RunningCard.tsx';
import { RunningDraftFlow } from './DraftFlow.tsx';
import { RunningImportPreview } from './ImportPreview.tsx';
import { RunningApiError, RunningIdentityChangedError } from './client.ts';
import './running.css';
import { RunChecklist } from './RunChecklist.tsx';
import { RunningHistory } from './RunningHistory.tsx';
import { RunningPlanActions } from './RunningPlanActions.tsx';
import { planToday, dayValue } from './calendar.ts';
import type { QueueEntry } from './queue.ts';
import { clearRunningPlan, ownedRunningKeys } from './privacy.ts';
import { browserQueueLocks } from './controller.ts';
const emptyPending: QueueEntry[] = [];
const noopSubscribe = () => () => {};

export function RunningPage() {
  const context = useRunning();
  const account = context.load.data?.enabled ? context.load.data.account : null;
  return <ResponsiveLayout><div className="training-dashboard">
    <header className="training-page-heading"><div><p className="training-eyebrow">YOUR RUNNING TRACK</p><h1>One run at a time.</h1></div></header>
    {context.load.phase !== 'ready' ? <RunningCardView load={context.load} retry={() => void context.refresh()} /> : <RunningWorkspace key={account?.incarnation ?? 'no-account'} />}
  </div></ResponsiveLayout>;
}
function RunningWorkspace() {
  const { client, load, online, controller, refresh, updateAccount } = useRunning();
  const data = load.data?.enabled ? load.data : null;
  const account = data?.account;
  const [mode, setMode] = useState<'home' | 'new' | 'draft' | 'history' | 'detail'>('home');
  const [draft, setDraft] = useState<CanonicalPlan | null>(null);
  const [list, setList] = useState<PlanListData | null>(null);
  const [listFilter, setListFilter] = useState<'draft' | 'archived'>('draft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const pending = useSyncExternalStore(controller?.subscribe ?? noopSubscribe, () => controller?.snapshot().entries ?? emptyPending);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run(action: () => Promise<void>) {
    if (!online || busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (cause) {
      if (!mounted.current || cause instanceof RunningIdentityChangedError) return;
      if (cause instanceof RunningApiError && cause.code === 'HISTORY_CHANGED') setList(null);
      setError(cause instanceof Error ? cause.message : 'Running could not be loaded. Retry when connected.');
    } finally { if (mounted.current) setBusy(false); }
  }
  async function drafts(more: boolean, filter = listFilter) {
    if (!client) return;
    const { data: page } = await client.plans({ lifecycle: filter, limit: 20, cursor: more ? list?.nextCursor ?? null : null });
    if (!mounted.current) return;
    if (more && list && page.historyGeneration !== list.historyGeneration) { setList(null); setError('Your plans changed. Reload drafts to continue.'); return; }
    setListFilter(filter); setList(more && list ? { ...page, items: [...list.items, ...page.items] } : page);
  }
  if (!client) return <p role="status">Preparing your running account...</p>;
  if (!account) return <section className="running-form"><h2>Start your running track</h2><p>Set up running independently of strength training. This creates an empty running account; it does not restore previously deleted plans.</p><button disabled={!online || busy} onClick={() => void run(async () => { await client.bootstrap({}); if (mounted.current) await refresh(); })}>Set up running</button>{error && <p role="alert">{error}</p>}</section>;
  const activated = () => { setMode('home'); setDraft(null); void refresh(); };
  const identity = JSON.stringify(client.scope());
  const actions = (selected: CanonicalPlan) => <RunningPlanActions key={`${identity}:${selected.id}`} identityKey={identity} plan={selected} generation={account.generation} online={online} enabled={true} pendingEdits={pending.some(entry => entry.planId === selected.id)} api={client}
    beforeAction={async () => { controller?.quiesce(); }}
    afterArchive={async () => { setMode('home'); setDraft(null); await refresh(); }}
    afterDelete={async id => { const userId = client.scope().userId; if (!userId) throw new Error('Account changed before device cleanup.'); if (controller) await controller.clearPlan(id); if (ownedRunningKeys(localStorage, userId).length) await clearRunningPlan(localStorage, browserQueueLocks(), userId, id); setList(null); setDraft(null); setMode('home'); await refresh(); }} />;
  if (mode === 'history') {
    const today = planToday(data?.activePlan?.timeZone ?? 'UTC'); const from = new Date((dayValue(today) - 27) * 86400000).toISOString().slice(0, 10);
    return <div className="running-form"><button onClick={() => setMode('home')}>Back to running</button><RunningHistory key={identity} identityKey={identity} online={online} distanceUnit={account.preferredUnits} api={client} initialFrom={from} initialTo={today} onCorrectResult={item => void run(async () => { const response = await client.plan(item.planId); if (mounted.current) { setDraft(response.data); setMode('detail'); } })} />{error && <p role="alert">{error}</p>}</div>;
  }
  if (mode === 'detail' && draft) return <div className="running-form"><button onClick={() => setMode('home')}>Back to running</button>{draft.program ? <RunChecklist key={draft.id} plan={draft} /> : <><h2>Archived running draft</h2><p>This draft was never activated. It has no run history.</p></>}{actions(draft)}</div>;
  if (mode === 'new') return <><button className="btn btn-secondary" onClick={() => { if (window.confirm('Leave this draft flow? Unsaved form and pasted text will be cleared. Saved drafts remain available.')) setMode('home'); }}>Back to running</button><RunningDraftFlow account={account} online={online} api={client} onAccount={updateAccount} onActivated={activated} /></>;
  if (mode === 'draft' && draft) return <><button className="btn btn-secondary" onClick={() => { if (window.confirm('Leave this preview? Unsaved pasted text will be cleared. Your saved draft remains available.')) setMode('home'); }}>Back to running</button><RunningImportPreview plan={draft} account={account} online={online} api={client} onAccount={updateAccount} onPlan={setDraft} onActivated={activated} />{actions(draft)}</>;
  return <section className="running-form">
    {!online && <p role="status">You are offline. Creating, opening and activating plans requires a connection.</p>}
    {data?.activePlan?.program ? <RunChecklist key={data.activePlan.id} plan={data.activePlan} /> : <><h2>Your running plan starts here</h2><p>Use your chosen LLM to prepare a plan, then review it before activation. Flexer makes no AI request.</p></>}
    <div className="running-actions"><button disabled={!online || busy} onClick={() => setMode('new')}>Create running draft</button><button disabled={!online || busy} onClick={() => void run(() => drafts(false, 'draft'))}>Load saved drafts</button><button disabled={!online || busy} onClick={() => void run(() => drafts(false, 'archived'))}>Load archived plans</button><button disabled={!online || busy} onClick={() => setMode('history')}>Running history and totals</button></div>
    {data?.activePlan && actions(data.activePlan)}
    {error && <p role="alert">{error}</p>}
    {list && <section aria-label="Saved running plans"><h2>{listFilter === 'draft' ? 'Saved drafts' : 'Archived plans'}</h2>{list.items.length ? <ul>{list.items.map(item => <li key={item.id}><button disabled={!online || busy} onClick={() => void run(async () => { const result = await client.plan(item.id); if (mounted.current) { if (result.data.lifecycle !== listFilter) { setList(null); throw new Error('This plan changed. Reload your plans.'); } setDraft(result.data); setMode(listFilter === 'draft' ? 'draft' : 'detail'); } })}>{item.name || 'Untitled running plan'} ({item.lifecycle})</button></li>)}</ul> : <p>No plans in this list.</p>}{list.nextCursor && <button disabled={!online || busy} onClick={() => void run(() => drafts(true))}>Load more plans</button>}</section>}
  </section>;
}
