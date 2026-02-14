import React, { useState, useEffect } from 'react';
import type { Exercise, WeightUnit, ExerciseLoadType } from '../types/workout';

export interface SetCompletionData {
  actualReps?: number;
  actualWeightValue?: number;
  actualWeightUnit?: WeightUnit;
  actualDurationSeconds?: number;
  actualDistanceValue?: number;
  actualDistanceUnit?: 'mi' | 'km' | 'm';
  qualitativeLoadLabel?: string;
}

interface SetDisplayProps {
  exercise: Exercise;
  setNumber: number;
  totalSets: number;
  onComplete: (data: SetCompletionData) => void;
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

  // Parse target reps and weight for defaults
  const parseTargetReps = (): number | undefined => {
    if (!exercise.reps) return undefined;
    // Handle ranges like "8-10" by taking the lower bound
    const match = exercise.reps.match(/^(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  };

  const parseTargetWeight = (): { value: number | undefined; unit: WeightUnit } => {
    if (!exercise.weight) return { value: undefined, unit: 'lbs' };
    const match = exercise.weight.match(/^(\d+(?:\.\d+)?)\s*(lbs?|kg)?/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit: WeightUnit = match[2]?.toLowerCase().startsWith('kg') ? 'kg' : 'lbs';
      return { value, unit };
    }
    return { value: undefined, unit: 'lbs' };
  };

  const targetReps = parseTargetReps();
  const targetWeight = parseTargetWeight();

  // Use loadType from exercise data, or infer for legacy plans
  const getLoadType = (): ExerciseLoadType => {
    if (exercise.loadType) return exercise.loadType;
    // Legacy fallback: infer from weight field only
    if (!exercise.weight) return 'bodyweight';
    const weight = exercise.weight.toLowerCase().trim();
    if (weight === 'bodyweight' || weight === 'bw' || weight === '') return 'bodyweight';
    if (/\d/.test(weight)) return 'external_weight';
    if (weight.includes('band')) return 'band';
    if (weight.includes('plate') || weight.includes('level')) return 'machine_level';
    return 'bodyweight';
  };

  const loadType = getLoadType();

  // Determine which inputs to show based on loadType
  const showWeightInput = loadType === 'external_weight' || loadType === 'assisted';
  const showBandInput = loadType === 'band';
  const showMachineLevelInput = loadType === 'machine_level';
  const showDurationInput = loadType === 'timed';
  const showDistanceInput = loadType === 'distance';
  const showRepsInput = !showDurationInput && !showDistanceInput;

  // Parse duration for timed exercises (e.g., "30 seconds", "45s")
  const parseTargetDuration = (): number | undefined => {
    if (!exercise.reps) return undefined;
    const match = exercise.reps.match(/(\d+)\s*(?:s|sec|seconds?)?/i);
    return match ? parseInt(match[1]) : undefined;
  };

  // Parse distance for distance exercises (e.g., "500m", "0.5 mile")
  const parseTargetDistance = (): { value: number | undefined; unit: 'mi' | 'km' | 'm' } => {
    if (!exercise.reps) return { value: undefined, unit: 'm' };
    const match = exercise.reps.match(/(\d+(?:\.\d+)?)\s*(mi|km|m|miles?|meters?)?/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unitStr = match[2]?.toLowerCase() || 'm';
      const unit: 'mi' | 'km' | 'm' = unitStr.startsWith('mi') ? 'mi' : unitStr === 'km' ? 'km' : 'm';
      return { value, unit };
    }
    return { value: undefined, unit: 'm' };
  };

  const targetDuration = parseTargetDuration();
  const targetDistance = parseTargetDistance();

  // Input state
  const [actualReps, setActualReps] = useState<string>(targetReps?.toString() || '');
  const [actualWeight, setActualWeight] = useState<string>(targetWeight.value?.toString() || '');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(targetWeight.unit);
  const [qualitativeLabel, setQualitativeLabel] = useState<string>(exercise.weight || '');
  const [actualDuration, setActualDuration] = useState<string>(targetDuration?.toString() || '');
  const [actualDistance, setActualDistance] = useState<string>(targetDistance.value?.toString() || '');
  const [distanceUnit, setDistanceUnit] = useState<'mi' | 'km' | 'm'>(targetDistance.unit);

  // Reset inputs when exercise/set changes
  useEffect(() => {
    setActualReps(targetReps?.toString() || '');
    setActualWeight(targetWeight.value?.toString() || '');
    setWeightUnit(targetWeight.unit);
    setQualitativeLabel(exercise.weight || '');
    setActualDuration(targetDuration?.toString() || '');
    setActualDistance(targetDistance.value?.toString() || '');
    setDistanceUnit(targetDistance.unit);
    setIsCompleted(false);
  }, [exercise.id, setNumber]);

  const handleComplete = () => {
    setIsCompleted(true);
    // Small delay to show completion state before moving on
    setTimeout(() => {
      const data: SetCompletionData = {};

      // Reps-based exercises
      if (showRepsInput && actualReps) {
        data.actualReps = parseInt(actualReps);
      }

      // Weight input (external_weight, assisted)
      if (showWeightInput && actualWeight) {
        data.actualWeightValue = parseFloat(actualWeight);
        data.actualWeightUnit = weightUnit;
      }

      // Band/machine level (qualitative)
      if ((showBandInput || showMachineLevelInput) && qualitativeLabel) {
        data.qualitativeLoadLabel = qualitativeLabel;
      }

      // Timed exercises
      if (showDurationInput && actualDuration) {
        data.actualDurationSeconds = parseInt(actualDuration);
      }

      // Distance exercises
      if (showDistanceInput && actualDistance) {
        data.actualDistanceValue = parseFloat(actualDistance);
        data.actualDistanceUnit = distanceUnit;
      }

      onComplete(data);
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
            <span className="detail-label">Target Reps</span>
            <span className="detail-value">{exercise.reps}</span>
          </div>

          {exercise.weight && (
            <div className="detail-item">
              <span className="detail-label">Target Weight</span>
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

        {/* Actual performance inputs */}
        <div className="actual-performance-inputs">
          <div className="input-row">
            {/* Reps input (for most exercises except timed/distance) */}
            {showRepsInput && (
              <div className="input-group">
                <label htmlFor="actual-reps">Actual Reps</label>
                <input
                  id="actual-reps"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={actualReps}
                  onChange={(e) => setActualReps(e.target.value)}
                  placeholder={targetReps?.toString() || '0'}
                  disabled={isCompleted}
                />
              </div>
            )}

            {/* Weight input (external_weight, assisted) */}
            {showWeightInput && (
              <div className="input-group weight-input">
                <label htmlFor="actual-weight">
                  {loadType === 'assisted' ? 'Assistance' : 'Weight'}
                </label>
                <div className="weight-input-row">
                  <input
                    id="actual-weight"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={actualWeight}
                    onChange={(e) => setActualWeight(e.target.value)}
                    placeholder={targetWeight.value?.toString() || '0'}
                    disabled={isCompleted}
                  />
                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
                    disabled={isCompleted}
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            )}

            {/* Band input (qualitative) */}
            {showBandInput && (
              <div className="input-group">
                <label htmlFor="band-level">Band</label>
                <input
                  id="band-level"
                  type="text"
                  value={qualitativeLabel}
                  onChange={(e) => setQualitativeLabel(e.target.value)}
                  placeholder="e.g., green, heavy"
                  disabled={isCompleted}
                />
              </div>
            )}

            {/* Machine level input (qualitative) */}
            {showMachineLevelInput && (
              <div className="input-group">
                <label htmlFor="machine-level">Level/Plate</label>
                <input
                  id="machine-level"
                  type="text"
                  value={qualitativeLabel}
                  onChange={(e) => setQualitativeLabel(e.target.value)}
                  placeholder="e.g., plate 8, level 5"
                  disabled={isCompleted}
                />
              </div>
            )}

            {/* Duration input (timed exercises) */}
            {showDurationInput && (
              <div className="input-group">
                <label htmlFor="actual-duration">Duration (seconds)</label>
                <input
                  id="actual-duration"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={actualDuration}
                  onChange={(e) => setActualDuration(e.target.value)}
                  placeholder={targetDuration?.toString() || '0'}
                  disabled={isCompleted}
                />
              </div>
            )}

            {/* Distance input (distance exercises) */}
            {showDistanceInput && (
              <div className="input-group distance-input">
                <label htmlFor="actual-distance">Distance</label>
                <div className="weight-input-row">
                  <input
                    id="actual-distance"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={actualDistance}
                    onChange={(e) => setActualDistance(e.target.value)}
                    placeholder={targetDistance.value?.toString() || '0'}
                    disabled={isCompleted}
                  />
                  <select
                    value={distanceUnit}
                    onChange={(e) => setDistanceUnit(e.target.value as 'mi' | 'km' | 'm')}
                    disabled={isCompleted}
                  >
                    <option value="m">m</option>
                    <option value="km">km</option>
                    <option value="mi">mi</option>
                  </select>
                </div>
              </div>
            )}
          </div>
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
