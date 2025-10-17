import React from 'react';
import type { Exercise } from '../types/workout';

interface ExerciseCardProps {
  exercise: Exercise;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise }) => {
  return (
    <div className="exercise-item">
      <h4 className="exercise-name">{exercise.name}</h4>
      
      <div className="exercise-details">
        <div className="exercise-detail">
          <span>Sets:</span>
          <strong>{exercise.sets}</strong>
        </div>
        <div className="exercise-detail">
          <span>Reps:</span>
          <strong>{exercise.reps}</strong>
        </div>
        {exercise.weight && (
          <div className="exercise-detail">
            <span>Weight:</span>
            <strong>{exercise.weight}</strong>
          </div>
        )}
        {exercise.restSeconds && (
          <div className="exercise-detail">
            <span>Rest:</span>
            <strong>{exercise.restSeconds}s</strong>
          </div>
        )}
      </div>
      
      {exercise.instructions && (
        <p className="exercise-instructions">{exercise.instructions}</p>
      )}
      
      {exercise.notes && (
        <p className="exercise-instructions">
          <strong>Note:</strong> {exercise.notes}
        </p>
      )}
    </div>
  );
};
