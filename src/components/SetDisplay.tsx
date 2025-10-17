import React, { useState } from 'react';
import type { Exercise } from '../types/workout';

interface SetDisplayProps {
  exercise: Exercise;
  setNumber: number;
  totalSets: number;
  onComplete: () => void;
  onBack?: () => void;
}

export const SetDisplay: React.FC<SetDisplayProps> = ({ 
  exercise, 
  setNumber, 
  totalSets, 
  onComplete,
  onBack 
}) => {
  const [isCompleted, setIsCompleted] = useState(false);

  const handleComplete = () => {
    setIsCompleted(true);
    // Small delay to show completion state before moving on
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div className="set-display">
      {/* Progress indicator */}
      <div className="set-progress-indicator">
        <div className="set-progress-text">
          Set {setNumber} of {totalSets}
        </div>
        <div className="set-progress-bar">
          <div 
            className="set-progress-fill"
            style={{ width: `${(setNumber / totalSets) * 100}%` }}
          />
        </div>
      </div>

      {/* Exercise card */}
      <div className={`exercise-set-card ${isCompleted ? 'completed' : ''}`}>
        <div className="exercise-header">
          <h2 className="exercise-name">{exercise.name}</h2>
          <div className="set-indicator">
            Set {setNumber} of {exercise.sets}
          </div>
        </div>

        <div className="exercise-details-grid">
          <div className="detail-item">
            <span className="detail-label">Reps</span>
            <span className="detail-value">{exercise.reps}</span>
          </div>
          
          {exercise.weight && (
            <div className="detail-item">
              <span className="detail-label">Weight</span>
              <span className="detail-value">{exercise.weight}</span>
            </div>
          )}
          
          {exercise.restSeconds && (
            <div className="detail-item">
              <span className="detail-label">Rest After</span>
              <span className="detail-value">{exercise.restSeconds}s</span>
            </div>
          )}
        </div>

        {exercise.instructions && (
          <div className="exercise-instructions-box">
            <h4>How to perform:</h4>
            <p>{exercise.instructions}</p>
          </div>
        )}

        {exercise.notes && (
          <div className="exercise-notes-box">
            <h4>Notes:</h4>
            <p>{exercise.notes}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="set-actions">
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack}>
            ← Back
          </button>
        )}
        
        <button 
          className={`btn ${isCompleted ? 'btn-success' : 'btn-primary'}`}
          onClick={handleComplete}
          disabled={isCompleted}
        >
          {isCompleted ? '✓ Completed!' : 'Complete Set'}
        </button>
      </div>
    </div>
  );
};
