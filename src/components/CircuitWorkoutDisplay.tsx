import React, { useState, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useWorkout } from '../context/WorkoutContext';
import { SetDisplay } from './SetDisplay';
import { RestTimer } from './RestTimer';
import type { Exercise } from '../types/workout';

interface WorkoutSet {
  exercise: Exercise;
  setNumber: number;
  exerciseIndex: number;
}

type WorkoutState = 'exercise' | 'rest' | 'completed';

export const CircuitWorkoutDisplay: React.FC = () => {
  const {
    currentWorkout,
    progress,
    currentPlan,
    loading,
    error,
    nextWorkout,
    previousWorkout,
    completeCurrentWorkout
  } = useWorkout();

  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [workoutState, setWorkoutState] = useState<WorkoutState>('exercise');
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  // Generate flat array of all sets in circuit order
  // NOTE: This must be before any early returns to satisfy React's rules of hooks
  const workoutSets = useMemo(() => {
    if (!currentWorkout) return [];

    const sets: WorkoutSet[] = [];
    const maxSets = Math.max(...currentWorkout.exercises.map(ex => ex.sets));

    // Create sets in circuit order: Set 1 of all exercises, then Set 2 of all, etc.
    for (let setNum = 1; setNum <= maxSets; setNum++) {
      currentWorkout.exercises.forEach((exercise, exerciseIndex) => {
        if (setNum <= exercise.sets) {
          sets.push({
            exercise,
            setNumber: setNum,
            exerciseIndex
          });
        }
      });
    }

    return sets;
  }, [currentWorkout]);

  // Show loading state
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading your workout...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="error-screen">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  // No plan available
  if (!currentPlan) {
    return (
      <div className="no-plan-screen">
        <h2>No Workout Plan</h2>
        <p>You don't have an active workout plan yet.</p>
        <a href="/onboarding" className="btn btn-primary">
          Create Your Plan
        </a>
      </div>
    );
  }

  const currentSet = workoutSets[currentSetIndex];
  const isLastSet = currentSetIndex >= workoutSets.length - 1;

  if (!currentWorkout || workoutSets.length === 0) {
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

  const handleSetComplete = () => {
    if (isLastSet) {
      // Workout completed
      setWorkoutState('completed');
      completeCurrentWorkout();
    } else {
      // Check if we need rest time
      const nextSet = workoutSets[currentSetIndex + 1];
      const shouldRest = currentSet.exercise.restSeconds && 
                        currentSet.exercise.restSeconds > 0 &&
                        nextSet?.exercise.id !== currentSet.exercise.id; // Only rest between different exercises
      
      if (shouldRest) {
        setWorkoutState('rest');
      } else {
        // Move to next set immediately
        setCurrentSetIndex(prev => prev + 1);
      }
    }
  };

  const handleRestComplete = () => {
    setWorkoutState('exercise');
    setCurrentSetIndex(prev => prev + 1);
  };

  const handleSkipRest = () => {
    setWorkoutState('exercise');
    setCurrentSetIndex(prev => prev + 1);
  };

  const handleBackToExercise = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(prev => prev - 1);
      setWorkoutState('exercise');
    }
  };

  const currentWeek = currentPlan.weeks[progress.currentWeek];
  const canGoPrevious = progress.currentWeek > 0 || progress.currentDay > 0;
  const canGoNext = progress.currentWeek < currentPlan.weeks.length - 1 ||
                   progress.currentDay < currentWeek.days.length - 1;

  const handleShare = async () => {
    if (!shareCardRef.current) return;

    setIsSharing(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2, // Higher resolution for better quality
      });

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      );

      if (!blob) {
        throw new Error('Failed to create image');
      }

      const file = new File([blob], 'flexer-workout.png', { type: 'image/png' });

      // Try Web Share API first (works on mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Flexer Workout Complete',
          text: `Just crushed ${currentWorkout?.name}! 💪`,
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flexer-workout.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // User cancelled or error occurred
      console.error('Share failed:', err);
    } finally {
      setIsSharing(false);
    }
  };

  // Workout completed state
  if (workoutState === 'completed') {
    return (
      <div className="completion-screen">
        {/* Share Card - this div gets rendered to image */}
        <div ref={shareCardRef} className="share-card">
          <div className="share-card-header">
            <span className="flexer-logo">FLEXER</span>
            <span className="share-date">{new Date().toLocaleDateString()}</span>
          </div>
          <h2>Workout Complete!</h2>
          <p className="workout-name">{currentWorkout.name}</p>
          <div className="share-stats">
            <div className="stat">
              <span className="stat-value">{workoutSets.length}</span>
              <span className="stat-label">Sets</span>
            </div>
            <div className="stat">
              <span className="stat-value">{currentWorkout.exercises.length}</span>
              <span className="stat-label">Exercises</span>
            </div>
          </div>
          <p className="share-tagline">Week {progress.currentWeek + 1}, Day {progress.currentDay + 1}</p>

          {/* Exercise list inside share card for image export */}
          <div className="share-exercise-list">
            {currentWorkout.exercises.map(ex => (
              <div key={ex.id} className="share-exercise-item">
                <span className="share-exercise-name">{ex.name}</span>
                <span className="share-exercise-detail">{ex.sets} × {ex.reps}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="btn btn-share"
          disabled={isSharing}
        >
          {isSharing ? 'Creating image...' : 'Share Workout'}
        </button>

        {/* Navigation */}
        <div className="button-group">
          <button
            className="btn btn-secondary"
            onClick={previousWorkout}
            disabled={!canGoPrevious}
          >
            ← Previous
          </button>
          <button
            className="btn btn-primary"
            onClick={nextWorkout}
            disabled={!canGoNext}
          >
            Next Workout →
          </button>
        </div>
      </div>
    );
  }

  // Rest state
  if (workoutState === 'rest' && currentSet?.exercise.restSeconds) {
    return (
      <div>
        <div className="workout-header">
          <h1>{currentWorkout.name}</h1>
          <div className="workout-progress">
            Set {currentSetIndex + 1} of {workoutSets.length}
          </div>
        </div>
        <RestTimer
          restSeconds={currentSet.exercise.restSeconds}
          onComplete={handleRestComplete}
          onSkip={handleSkipRest}
        />
      </div>
    );
  }

  // Exercise state - show current set
  return (
    <div>
      <div className="workout-header">
        <h1>{currentWorkout.name}</h1>
        <div className="workout-progress">
          <span>Set {currentSetIndex + 1} of {workoutSets.length}</span>
          <span>Week {progress.currentWeek + 1}, Day {progress.currentDay + 1}</span>
        </div>
      </div>

      <SetDisplay
        key={currentSetIndex}
        exercise={currentSet.exercise}
        setNumber={currentSet.setNumber}
        totalSets={currentSet.exercise.sets}
        onComplete={handleSetComplete}
        onBack={currentSetIndex > 0 ? handleBackToExercise : undefined}
      />

      {/* Show what's coming next */}
      {!isLastSet && (
        <div className="next-set-preview">
          <h4>Next up:</h4>
          <p>
            {workoutSets[currentSetIndex + 1].exercise.name} - 
            Set {workoutSets[currentSetIndex + 1].setNumber} of {workoutSets[currentSetIndex + 1].exercise.sets}
          </p>
        </div>
      )}
    </div>
  );
};
