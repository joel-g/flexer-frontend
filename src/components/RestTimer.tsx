import { useEffect, useRef, useState } from 'react';
interface NextExerciseInfo { name: string; setNumber: number; totalSets: number; reps: string; weight?: string }
interface RestTimerProps { restSeconds: number; onComplete: () => void; onSkip: () => void; nextExercise?: NextExerciseInfo }
export function RestTimer({ restSeconds, onComplete, onSkip, nextExercise }: RestTimerProps) {
  const [remaining, setRemaining] = useState(restSeconds);
  const [deadline, setDeadline] = useState(() => Date.now() + restSeconds * 1000);
  const [paused, setPaused] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  useEffect(() => {
    if (paused) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [deadline, paused]);
  const ready = remaining === 0;
  const togglePause = () => { if (paused) setDeadline(Date.now() + remaining * 1000); setPaused(!paused); };
  const extend = () => {
    const next = (paused ? remaining : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))) + 15;
    setRemaining(next); setDeadline(Date.now() + next * 1000);
  };
  return <section className="rest-timer" aria-labelledby="rest-title">
    <div className="rest-timer-header"><h2 id="rest-title" ref={title} tabIndex={-1}>{ready ? 'Ready when you are' : paused ? 'Rest paused' : 'Take a breather'}</h2></div>
    <div className="rest-timer-display" role="timer" aria-label={`${remaining} seconds remaining`}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</div>
    <p role="status">{ready ? 'Rest complete. Continue when you feel ready.' : 'Your set is logged. Prepare for the next one.'}</p>
    <div className="rest-timer-controls"><button className="btn btn-secondary" disabled={ready} onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button><button className="btn btn-secondary" onClick={extend}>+15 seconds</button></div>
    {nextExercise && <div className="rest-up-next"><p className="rest-up-next-label">Up next · Set {nextExercise.setNumber} of {nextExercise.totalSets}</p><h3 className="rest-up-next-name">{nextExercise.name}</h3><p className="rest-up-next-details">{nextExercise.reps}{nextExercise.weight ? ` · ${nextExercise.weight}` : ''}</p></div>}
    <button className="btn btn-primary" onClick={ready ? onComplete : onSkip}>{ready ? 'Continue workout' : 'Skip rest'}</button>
  </section>;
}
