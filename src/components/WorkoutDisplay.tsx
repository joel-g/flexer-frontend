import React from 'react';
import { useWorkout } from '../context/WorkoutContext';
import { ExerciseCard } from './ExerciseCard';

export const WorkoutDisplay: React.FC = () => {
  const { 
    currentWorkout, 
    progress, 
    currentPlan, 
    nextWorkout, 
    previousWorkout, 
    completeCurrentWorkout 
  } = useWorkout();

  if (!currentWorkout || !currentPlan) {
    return (
      <div className="completion-screen">
        <h2>🎉 Congratulations!</h2>
        <p>You've completed all available workouts in your current plan.</p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Start Over
        </button>
      </div>
    );
  }

  const currentWeek = currentPlan.weeks[progress.currentWeek];
  const isCompleted = progress.completedWorkouts.includes(currentWorkout.id);
  const canGoPrevious = progress.currentWeek > 0 || progress.currentDay > 0;
  const canGoNext = progress.currentWeek < currentPlan.weeks.length - 1 || 
                   progress.currentDay < currentWeek.days.length - 1;

  const handleComplete = () => {
    completeCurrentWorkout();
    // Auto-advance to next workout after completing
    if (canGoNext) {
      setTimeout(() => {
        nextWorkout();
      }, 1000);
    }
  };

  return (
    <div>
      {/* Progress Indicator */}
      <div className="progress-indicator">
        <p className="progress-text">
          Week {progress.currentWeek + 1} of {currentPlan.weeks.length} • 
          Day {progress.currentDay + 1} of {currentWeek.days.length}
        </p>
      </div>

      {/* Current Workout */}
      <div className="workout-card">
        <h2 className="workout-title">{currentWorkout.name}</h2>
        
        {currentWorkout.description && (
          <p className="workout-description">{currentWorkout.description}</p>
        )}
        
        <div className="workout-meta">
          <span>Week {currentWeek.weekNumber}: {currentWeek.name}</span>
          {currentWorkout.estimatedDuration && (
            <span>~{currentWorkout.estimatedDuration} min</span>
          )}
        </div>

        {/* Exercise List */}
        <div className="exercise-list">
          {currentWorkout.exercises.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="button-group">
          <button 
            className="btn btn-secondary"
            onClick={previousWorkout}
            disabled={!canGoPrevious}
          >
            ← Previous
          </button>
          
          {!isCompleted ? (
            <button 
              className="btn btn-success"
              onClick={handleComplete}
            >
              Complete Workout ✓
            </button>
          ) : (
            <button 
              className="btn btn-primary"
              onClick={nextWorkout}
              disabled={!canGoNext}
            >
              Next Workout →
            </button>
          )}
        </div>

        {isCompleted && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: '16px', 
            color: '#48bb78',
            fontWeight: '600'
          }}>
            ✓ Workout Completed!
          </div>
        )}
      </div>
    </div>
  );
};
