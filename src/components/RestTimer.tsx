import React, { useState, useEffect } from 'react';

interface RestTimerProps {
  restSeconds: number;
  onComplete: () => void;
  onSkip: () => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({ restSeconds, onComplete, onSkip }) => {
  const [timeLeft, setTimeLeft] = useState(restSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(time => {
        if (time <= 1) {
          setIsActive(false);
          onComplete();
          return 0;
        }
        return time - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    const percentage = timeLeft / restSeconds;
    if (percentage > 0.6) return '#48bb78'; // Green
    if (percentage > 0.3) return '#ed8936'; // Orange
    return '#e53e3e'; // Red
  };

  const pauseTimer = () => setIsActive(false);
  const resumeTimer = () => setIsActive(true);

  return (
    <div className="rest-timer">
      <div className="rest-timer-header">
        <h3>Rest Time</h3>
        <button className="btn btn-secondary" onClick={onSkip}>
          Skip Rest
        </button>
      </div>
      
      <div 
        className="rest-timer-display"
        style={{ color: getTimerColor() }}
      >
        {formatTime(timeLeft)}
      </div>
      
      <div className="rest-timer-controls">
        {isActive ? (
          <button className="btn btn-secondary" onClick={pauseTimer}>
            ⏸️ Pause
          </button>
        ) : timeLeft > 0 ? (
          <button className="btn btn-primary" onClick={resumeTimer}>
            ▶️ Resume
          </button>
        ) : (
          <button className="btn btn-success" onClick={onComplete}>
            Continue →
          </button>
        )}
      </div>
      
      <div className="rest-suggestions">
        <p>💡 Use this time to hydrate and prepare for the next set</p>
      </div>
    </div>
  );
};
