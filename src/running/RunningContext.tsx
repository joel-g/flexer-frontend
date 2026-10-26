import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { RunningClient, RunningIdentityChangedError } from './client.ts';
import type { AccountState } from './contract.ts';
import { RunningContext, type RunningLoad } from './useRunning.ts';
import { pendingDisposition } from './state.ts';
import { browserQueueLocks, RunningController } from './controller.ts';
import { clearRunningAccount, ownedRunningKeys } from './privacy.ts';

const loading: RunningLoad = { phase: 'loading', data: null, message: '' };

/** Auth loss unmounts all private running UI immediately; no persistent replay occurs here. */
export function RunningProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId, sessionId, getToken } = useAuth();
  if (!isLoaded) return <p role="status">Loading your account...</p>;
  if (!userId) return children;
  return <AuthenticatedRunningProvider key={`${userId}:${sessionId ?? 'no-session'}`} getToken={getToken} userId={userId}>{children}</AuthenticatedRunningProvider>;
}
function AuthenticatedRunningProvider({ userId, getToken, children }: { userId: string; getToken: () => Promise<string | null>; children: ReactNode }) {
  const [client, setClient] = useState<RunningClient | null>(null);
  const [load, setLoad] = useState<RunningLoad>(loading);
  const [controller, setController] = useState<RunningController | null>(null);
  const controllerRef = useRef<RunningController | null>(null);
  const privacyPause = useRef<(message: string, disabled?: boolean) => void>(() => {});
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const request = useRef(0);
  const tokenGetter = useRef(getToken);
  useEffect(() => { tokenGetter.current = getToken; }, [getToken]);
  useEffect(() => {
    const invalidate = () => { request.current++; };
    const next = new RunningClient(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787');
    next.onFailure(error => { const reason = pendingDisposition(error); if (reason === 'paused-auth' || reason === 'paused-feature') privacyPause.current(reason === 'paused-feature' ? 'Running is unavailable. Saved edits are paused.' : 'Sign in again, then explicitly recover your pending running edits.', reason === 'paused-feature'); });
    next.setIdentity(userId, () => tokenGetter.current()); setClient(next); setLoad(loading);
    return () => { invalidate(); next.setIdentity(null, null); };
  }, [userId]);
  privacyPause.current = (message, disabled = false) => {
    request.current++; controllerRef.current?.pause(); client?.cancelPending();
    setLoad({ phase: disabled ? 'disabled' : 'error', data: null, message });
  };
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change); window.addEventListener('offline', change);
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); };
  }, []);
  const refresh = useCallback(async () => {
    if (!client) return;
    const ticket = ++request.current;
    const scope = client.scope();
    setLoad(loading);
    try {
      const { data } = await client.state();
      if (ticket !== request.current) return;
      if (data.enabled && data.account) client.bindIncarnation(scope, data.account.incarnation);
      setLoad({ phase: data.enabled ? 'ready' : 'disabled', data, message: '' });
    } catch (error) {
      if (ticket !== request.current || error instanceof RunningIdentityChangedError) return;
      const disposition = pendingDisposition(error);
      setLoad({ phase: disposition === 'paused-feature' ? 'disabled' : 'error', data: null, message: disposition === 'paused-auth' ? 'Sign in again to load running. Pending edits are paused.' : !navigator.onLine ? 'You are offline. Saved running edits remain on this device. Reconnect and revalidate your account to reopen the plan.' : 'Running could not be loaded. Your strength plan is independent.' });
    }
  }, [client]);
  useEffect(() => { void refresh(); }, [refresh]);
  const incarnation = load.data?.enabled ? load.data.account?.incarnation : null;
  useEffect(() => {
    if (!client || !incarnation) return;
    let next: RunningController;
    try {
      next = new RunningController({ account: { userId, incarnation }, storage: localStorage, locks: browserQueueLocks(), client, onPrivacyFailure: error => privacyPause.current('Running edits are paused. Sign in and explicitly recover before continuing.', pendingDisposition(error) === 'paused-feature'), onRun: run => {
        setLoad(current => { if (!current.data?.enabled || !current.data.activePlan?.program || current.data.activePlan.id !== run.planId) return current;
          const data = structuredClone(current.data);
          for (const week of data.activePlan!.program!.weeks) for (const prescription of week.runs) if (prescription.id === run.id && prescription.result.revision < run.revision) prescription.result = run;
          return { ...current, data };
        });
      } });
      controllerRef.current = next; setController(next); void next.initialize();
    } catch (error) { setLoad(current => ({ ...current, message: error instanceof Error ? error.message : 'Offline storage is unavailable.' })); return; }
    return () => { next.dispose(); if (controllerRef.current === next) controllerRef.current = null; };
  }, [client, incarnation, userId]);
  useEffect(() => { controller?.setOnline(online); }, [controller, online]);
  useEffect(() => {
    const listener = (event: StorageEvent) => { if (event.key === `flexer:running:signout:${userId}`) privacyPause.current('Signed out in another tab. Running edits are paused.'); else if (event.key?.startsWith('flexer:running:v1:')) void controllerRef.current?.load(); };
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener);
  }, [userId]);
  async function recover() {
    if (!client || !online) throw new Error('Connect and sign in before recovering running edits.');
    const scope = client.scope(); const { data } = await client.state();
    if (!data.enabled || !data.account || data.account.incarnation !== scope.incarnation) { await refresh(); return; }
    if (controllerRef.current) await controllerRef.current.recover();
  }
  async function prepareSignout(confirmedDeletion = false) {
    let pending = false;
    for (const key of ownedRunningKeys(localStorage, userId)) {
      try { const saved = JSON.parse(localStorage.getItem(key) ?? '{}'); if (!Array.isArray(saved.entries) || saved.entries.length) pending = true; } catch { pending = true; }
    }
    if (!confirmedDeletion && pending && !window.confirm('You have pending running edits on this device. Signing out clears them permanently. Cancel to sync or resolve them first. Sign out and clear these edits?')) return false;
    privacyPause.current('Clearing private running data before signout...');
    try {
      localStorage.setItem(`flexer:running:signout:${userId}`, crypto.randomUUID());
      if (ownedRunningKeys(localStorage, userId).length) await clearRunningAccount(localStorage, browserQueueLocks(), userId);
      return true;
    } catch { privacyPause.current('Running is paused, but private device storage could not be cleared. Signout was stopped. Retry clearing it before leaving this device.'); throw new Error('Private running storage could not be cleared. Signout was stopped.'); }
  }
  function updateAccount(account: AccountState) {
    if (!client || client.scope().incarnation !== account.incarnation) { void refresh(); return; }
    setLoad(current => current.data?.enabled ? { ...current, data: { ...current.data, account } } : current);
  }
  return <RunningContext.Provider value={{ client, load, online, controller, refresh, recover, prepareSignout, updateAccount }}>{children}</RunningContext.Provider>;
}
