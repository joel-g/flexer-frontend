import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { WorkoutProgress, WorkoutDay, WorkoutPlan } from '../types/workout';
import { workoutConfig } from '../data/workoutConfig';

interface WorkoutContextType {
  currentPlan: WorkoutPlan;
  progress: WorkoutProgress;
  currentWorkout: WorkoutDay | null;
  nextWorkout: () => void;
  previousWorkout: () => void;
  completeCurrentWorkout: () => void;
  resetProgress: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
};

interface WorkoutProviderProps {
  children: ReactNode;
}

export const WorkoutProvider: React.FC<WorkoutProviderProps> = ({ children }) => {
  const [progress, setProgress] = useState<WorkoutProgress>(() => {
    const saved = localStorage.getItem('workout-progress');
    return saved ? JSON.parse(saved) : { currentWeek: 0, currentDay: 0, completedWorkouts: [] };
  });

  const currentPlan = workoutConfig.currentPlan;

  useEffect(() => {
    localStorage.setItem('workout-progress', JSON.stringify(progress));
  }, [progress]);

  const getCurrentWorkout = (): WorkoutDay | null => {
    if (progress.currentWeek >= currentPlan.weeks.length) {
      return null; // Plan completed
    }
    
    const currentWeek = currentPlan.weeks[progress.currentWeek];
    if (progress.currentDay >= currentWeek.days.length) {
      return null; // Week completed
    }
    
    return currentWeek.days[progress.currentDay];
  };

  const nextWorkout = () => {
    setProgress(prev => {
      const newProgress = { ...prev };
      const currentWeek = currentPlan.weeks[newProgress.currentWeek];
      
      if (newProgress.currentDay < currentWeek.days.length - 1) {
        // Next day in current week
        newProgress.currentDay++;
      } else {
        // Next week, first day
        newProgress.currentWeek++;
        newProgress.currentDay = 0;
      }
      
      return newProgress;
    });
  };

  const previousWorkout = () => {
    setProgress(prev => {
      const newProgress = { ...prev };
      
      if (newProgress.currentDay > 0) {
        // Previous day in current week
        newProgress.currentDay--;
      } else if (newProgress.currentWeek > 0) {
        // Previous week, last day
        newProgress.currentWeek--;
        const prevWeek = currentPlan.weeks[newProgress.currentWeek];
        newProgress.currentDay = prevWeek.days.length - 1;
      }
      
      return newProgress;
    });
  };

  const completeCurrentWorkout = () => {
    const currentWorkout = getCurrentWorkout();
    if (currentWorkout) {
      setProgress(prev => ({
        ...prev,
        completedWorkouts: [...prev.completedWorkouts, currentWorkout.id]
      }));
    }
  };

  const resetProgress = () => {
    setProgress({ currentWeek: 0, currentDay: 0, completedWorkouts: [] });
  };

  return (
    <WorkoutContext.Provider value={{
      currentPlan,
      progress,
      currentWorkout: getCurrentWorkout(),
      nextWorkout,
      previousWorkout,
      completeCurrentWorkout,
      resetProgress
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};
