import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useWorkout } from '../context/WorkoutContext';
import { SetDisplay } from './SetDisplay';
import type { SetCompletionData } from './SetDisplay';
import { RestTimer } from './RestTimer';
import type { Exercise, LoadType } from '../types/workout';

// Get loadType from exercise, or infer for legacy plans
function getExerciseLoadType(exercise: Exercise): LoadType {
  if (exercise.loadType) return exercise.loadType;
  // Legacy fallback: infer from weight field only
  if (!exercise.weight) return 'bodyweight';
  const weight = exercise.weight.toLowerCase().trim();
  if (weight === 'bodyweight' || weight === 'bw' || weight === '') return 'bodyweight';
  if (/\d/.test(weight)) return 'external_weight';
  if (weight.includes('band')) return 'band';
  if (weight.includes('plate') || weight.includes('level')) return 'machine_level';
  return 'bodyweight';
}

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
    completeCurrentWorkout,
    currentSessionId,
    startWorkoutSession,
    logSetCompletion,
    endWorkoutSession,
    resumedSetLogs,
  } = useWorkout();

  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [workoutState, setWorkoutState] = useState<WorkoutState>('exercise');
  const [isSharing, setIsSharing] = useState(false);
  const [completedSetsCount, setCompletedSetsCount] = useState(0);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const sessionStartedRef = useRef(false);

  // Start session when workout begins
  useEffect(() => {
    if (currentWorkout && !currentSessionId && !sessionStartedRef.current && workoutState === 'exercise') {
      sessionStartedRef.current = true;
      startWorkoutSession().then((sessionId) => {
        if (!sessionId) {
          sessionStartedRef.current = false;
        }
      });
    }
  }, [currentWorkout, currentSessionId, workoutState]);

  // Reset session ref when workout changes
  useEffect(() => {
    sessionStartedRef.current = false;
    setCompletedSetsCount(0);
    setCurrentSetIndex(0);
  }, [currentWorkout?.id]);

  // Ref to track if resume has been applied
  const resumeAppliedRef = useRef(false);

  // Reset resume flag when workout changes
  useEffect(() => {
    resumeAppliedRef.current = false;
  }, [currentWorkout?.id]);

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

  // Restore position from resumed set logs (must be after workoutSets memo)
  useEffect(() => {
    // Only apply resume once per session, when we have both set logs and workout sets
    if (resumedSetLogs.length > 0 && workoutSets.length > 0 && !resumeAppliedRef.current) {
      resumeAppliedRef.current = true;

      // Build a set of completed (exerciseId, setNumber) pairs from resumed logs
      const completedPairs = new Set(
        resumedSetLogs
          .filter(log => log.completed)
          .map(log => `${log.exerciseId}:${log.setNumber}`)
      );

      // Find the first set that hasn't been completed
      let resumeIndex = workoutSets.length; // Default to end if all completed
      for (let i = 0; i < workoutSets.length; i++) {
        const key = `${workoutSets[i].exercise.id}:${workoutSets[i].setNumber}`;
        if (!completedPairs.has(key)) {
          resumeIndex = i;
          break;
        }
      }

      // Restore state
      const completedCount = completedPairs.size;
      console.log(`Resuming workout: ${completedCount} sets completed, starting at set ${resumeIndex + 1}`);

      setCompletedSetsCount(completedCount);
      setCurrentSetIndex(resumeIndex);

      // If all sets were completed, mark workout as completed
      if (resumeIndex >= workoutSets.length) {
        setWorkoutState('completed');
      }
    }
  }, [resumedSetLogs, workoutSets]);

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

  const handleSetComplete = async (data: SetCompletionData) => {
    // Log the set completion
    if (currentSessionId) {
      await logSetCompletion({
        exerciseId: currentSet.exercise.id,
        exerciseName: currentSet.exercise.name,
        setNumber: currentSet.setNumber,
        targetReps: currentSet.exercise.reps,
        targetWeight: currentSet.exercise.weight,
        actualReps: data.actualReps,
        actualWeightValue: data.actualWeightValue,
        actualWeightUnit: data.actualWeightUnit,
        actualDurationSeconds: data.actualDurationSeconds,
        actualDistanceValue: data.actualDistanceValue,
        actualDistanceUnit: data.actualDistanceUnit,
        qualitativeLoadLabel: data.qualitativeLoadLabel,
        loadType: getExerciseLoadType(currentSet.exercise),
      });
    }
    setCompletedSetsCount(prev => prev + 1);

    if (isLastSet) {
      // End session before completing workout
      const totalSets = workoutSets.length;
      await endWorkoutSession(totalSets, completedSetsCount + 1);
      // Workout completed
      setWorkoutState('completed');
      await completeCurrentWorkout();
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
          nextExercise={workoutSets[currentSetIndex + 1] ? {
            name: workoutSets[currentSetIndex + 1].exercise.name,
            setNumber: workoutSets[currentSetIndex + 1].setNumber,
            totalSets: workoutSets[currentSetIndex + 1].exercise.sets,
            reps: workoutSets[currentSetIndex + 1].exercise.reps,
            weight: workoutSets[currentSetIndex + 1].exercise.weight,
          } : undefined}
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
