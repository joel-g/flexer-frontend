import { Link } from 'react-router-dom';
import { useRunning, type RunningLoad } from './useRunning.ts';

export function RunningCardView({ load, retry }: { load: RunningLoad; retry: () => void }) {
  const data = load.data?.enabled ? load.data : null;
  return <section className="training-state running-dashboard-card" aria-label="Running track">
    <p className="training-eyebrow">RUNNING</p>
    {load.phase === 'loading' ? <p role="status">Loading your running track...</p> : load.phase === 'disabled' ? <><h2>Running is currently unavailable</h2><p>Saved running data is retained. Your strength training remains available.</p></> : load.phase === 'error' ? <><p role="alert">{load.message}</p><button className="btn btn-secondary" onClick={retry}>Retry running</button></> : <>
      <h2>{data?.activePlan?.program?.name ?? 'A separate track for your miles'}</h2>
      <p>{data?.activePlan ? 'Your running plan and strength plan stay independent.' : 'Build a running plan, with or without a strength plan.'}</p>
      <Link className="btn btn-primary" to="/running">{data?.activePlan ? 'Open running plan' : data?.draftCount ? 'Continue running draft' : 'Start running'}</Link>
    </>}
  </section>;
}
export function RunningCard() { const { load, refresh } = useRunning(); return <RunningCardView load={load} retry={() => void refresh()} />; }
