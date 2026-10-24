import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useAuth, setFixtureIdentity, getFixtureIdentity, configureFixtureTokens } from './clerk';
import { createWorkerTransport } from './workerTransport';
import { RunningProvider } from '../../src/running/RunningContext';
import { RunningPage } from '../../src/running/RunningPage';
import { DashboardPage } from '../../src/pages/DashboardPage';
import { ProfilePage } from '../../src/pages/ProfilePage';
import { ThemeProvider } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';
import fixtures from '../fixtures/running-contract.json';
import '../../src/index.css'; import '../../src/App.css'; import '../../src/production.css';

let online = true, nextFailure = '';
const search = new URLSearchParams(location.search);
if (search.get('transport') === 'worker' && search.get('api')) sessionStorage.setItem('flexer:synthetic-worker-base', search.get('api')!);
if (search.get('transport') === 'mock') sessionStorage.removeItem('flexer:synthetic-worker-base');
const workerBase = sessionStorage.getItem('flexer:synthetic-worker-base');
const worker = workerBase ? await createWorkerTransport(workerBase) : null;
const subjects = worker?.subjects ?? ['synthetic-A', 'synthetic-B'];
if (worker) configureFixtureTokens(worker.getToken, subjects[0]);
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
const key = (user: string) => `flexer:synthetic-fixture:${user}`;
function initial(mode = 'both') { const active = structuredClone(fixtures.activePlan); for (const week of active.program.weeks) for (const run of week.runs) run.result = { ...run.result, status: 'pending', revision: 0, actualDate: null, actualMeters: null, durationSeconds: null, durationSource: null, effortRpe: null, notes: null }; return { mode, active: ['both', 'running'].includes(mode) ? active : null, account: { incarnation: fixtures.headers['X-Account-Incarnation'], generation: 0, settingsRevision: 0, historyGeneration: 0, activePlanId: ['both', 'running'].includes(mode) ? active.id : null, preferredUnits: 'mi' }, receipts: {}, draft: structuredClone(fixtures.draftPlan) }; }
function state(user: string) { return JSON.parse(localStorage.getItem(key(user)) ?? 'null') ?? initial(); }
const success = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, code: string, current?: unknown) => new Response(JSON.stringify({ success: false, code, error: `Synthetic ${code}`, requestId: 'synthetic-only', current }), { status, headers: { 'Content-Type': 'application/json' } });
window.fetch = async (input, options = {}) => {
  const url = new URL(String(input), location.href);
  if (url.origin !== 'http://fixture.invalid') throw new Error('Fixture forbids external requests.');
  if (!online) throw new Error('Synthetic offline');
  if (worker && workerBase) return worker.fetch(new URL(url.pathname + url.search, workerBase), options);
  const owner = new Headers(options.headers).get('Authorization')?.replace('Bearer synthetic-token-', '');
  if (!owner?.startsWith('synthetic-')) return fail(401, 'AUTH_REQUIRED');
  const store = state(owner), path = url.pathname, method = options.method ?? 'GET';
  if (nextFailure === 'auth') { nextFailure = ''; return fail(401, 'AUTH_REQUIRED'); }
  if (nextFailure === 'disabled') { nextFailure = ''; return fail(403, 'FEATURE_DISABLED'); }
  const persist = () => localStorage.setItem(key(owner), JSON.stringify(store));
  if (path === '/running/state') return success({ enabled: true, account: store.account, activePlan: store.active, draftCount: 1 });
  if (path === '/running/plans') return success({ items: [{ id: store.draft.id, lifecycle: 'draft', revision: store.draft.revision, name: 'Synthetic saved draft', createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z' }], nextCursor: null, historyGeneration: store.account.historyGeneration });
  if (path.includes('/runs/')) {
    const runId = path.split('/')[5], run = store.active?.program.weeks.flatMap(week => week.runs).find(run => run.id === runId);
    if (!run) return fail(404, 'NOT_FOUND');
    const body = JSON.parse(String(options.body));
    if (store.receipts[body.mutationId]) return success(store.receipts[body.mutationId]);
    if (nextFailure === 'conflict') { nextFailure = ''; run.result.revision++; persist(); return fail(409, 'REVISION_CONFLICT', { run: run.result }); }
    if (body.expectedRevision !== run.result.revision) return fail(409, 'REVISION_CONFLICT', { run: run.result });
    if (path.endsWith('/schedule')) run.result = { ...run.result, scheduledDate: body.date, revision: run.result.revision + 1 };
    else { const meters = body.actualDistance ? body.actualDistance.value * ({ m: 1, km: 1000, mi: 1609.344 }[body.actualDistance.unit]) : null; const seconds = body.durationSeconds ?? (body.paceSecondsPerKm && meters ? body.paceSecondsPerKm * meters / 1000 : null); run.result = { ...run.result, revision: run.result.revision + 1, status: body.status, actualDate: body.actualDate, actualMeters: meters, durationSeconds: seconds, durationSource: body.durationSeconds !== null ? 'entered' : seconds !== null ? 'derived_from_pace' : null, effortRpe: body.effortRpe ?? null, notes: body.notes ?? null }; }
    store.receipts[body.mutationId] = run.result; persist(); if (nextFailure === 'lost') { nextFailure = ''; throw new Error('Synthetic lost response after save'); } return success(run.result);
  }
  if (path.startsWith('/running/plans/')) return success(path.endsWith(store.draft.id) ? store.draft : store.active);
  if (path === '/profile/onboarding-status') return success({ completed: ['both', 'strength'].includes(store.mode) });
  if (path === '/plans') return success({ plans: ['both', 'strength'].includes(store.mode) ? [{ id: 'synthetic-strength', name: 'Synthetic strength plan', description: 'Independent strength fixture', planData: { weeks: [] } }] : [] });
  if (path === '/progress') return success({ currentWeek: 0, currentDay: 0, completedWorkouts: [] });
  if (path === '/profile' && method === 'DELETE') { localStorage.removeItem(key(owner)); return success({ deleted: true }); }
  if (path === '/profile') return success({ id: 'synthetic-profile', userId: owner });
  if (path.startsWith('/analytics/')) return fail(503, 'TEMPORARY_FAILURE');
  return fail(422, 'VALIDATION_FAILED');
};
function Harness() {
  const auth = useAuth(); const [ready, setReady] = useState('');
  useEffect(() => { api.setTokenGetter(auth.userId ? auth.getToken : null); setReady(auth.userId ?? 'signed-out'); return () => api.setTokenGetter(null); }, [auth.userId]);
  return <><aside style={{ background: '#fff4cb', color: '#222', padding: 12, position: 'relative', zIndex: 99 }}><strong>SYNTHETIC LOCAL QA — {worker ? 'actual local Worker/CORS' : 'mock API; BYOL/history unavailable'}</strong> <Link to="/dashboard">Dashboard</Link> <Link to="/running">Running</Link> <Link to="/profile">Profile</Link><div>{['neither', 'strength', 'running', 'both'].map(mode => <button key={mode} disabled={!!worker} onClick={() => { localStorage.setItem(key(getFixtureIdentity() ?? 'synthetic-A'), JSON.stringify(initial(mode))); location.href = '/dashboard'; }}>{mode}</button>)}<button onClick={() => { online = !online; window.dispatchEvent(new Event(online ? 'online' : 'offline')); }}>Toggle simulated offline</button>{['conflict', 'lost', 'auth', 'disabled'].map(mode => <button key={mode} disabled={!!worker} onClick={() => { nextFailure = mode; }}>Next request: {mode}</button>)}<button onClick={() => setFixtureIdentity(subjects[0])}>Account A / fresh session</button><button onClick={() => setFixtureIdentity(subjects[1])}>Account B</button><button onClick={() => setFixtureIdentity(null)}>Ambiguous auth loss</button><a href="/fixture.html?transport=mock">Reset to mock transport</a></div></aside>{auth.userId && ready === auth.userId ? <RunningProvider><Routes><Route path="/running" element={<RunningPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="*" element={<DashboardPage />} /></Routes></RunningProvider> : <p role="status">Signed out. Select a synthetic account to recover.</p>}</>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><BrowserRouter><Harness /></BrowserRouter></ThemeProvider>);
