import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { PlanResponse, WorkoutProgress, WorkoutWeek, WorkoutDay } from '../types/workout';

export function PlanOverviewPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [progress, setProgress] = useState<WorkoutProgress | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [plansRes, progressRes] = await Promise.all([
        api.get<{ plans: PlanResponse[] }>('/plans?active=true'),
        api.get<WorkoutProgress>('/progress'),
      ]);

      if (plansRes.success && plansRes.data?.plans.length) {
        setPlan(plansRes.data.plans[0]);
        // Expand current week by default
        if (progressRes.success && progressRes.data) {
          setExpandedWeek(progressRes.data.currentWeek);
        }
      }

      if (progressRes.success && progressRes.data) {
        setProgress(progressRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function isWorkoutCompleted(dayId: string): boolean {
    return progress?.completedWorkouts.includes(dayId) || false;
  }

  function isCurrentWorkout(weekIndex: number, dayIndex: number): boolean {
    return progress?.currentWeek === weekIndex && progress?.currentDay === dayIndex;
  }

  if (loading) {
    return <div className="plan-page loading">Loading...</div>;
  }

  if (!plan) {
    return (
      <div className="plan-page">
        <div className="no-plan">
          <p>No active plan found.</p>
          <button onClick={() => navigate('/onboarding')} className="btn btn-primary">
            Create Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plan-page">
      <header className="plan-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          ← Back
        </button>
        <h1>{plan.name}</h1>
      </header>

      <p className="plan-description">{plan.description}</p>

      <div className="weeks-list">
        {plan.planData.weeks.map((week: WorkoutWeek, weekIndex: number) => (
          <div key={week.weekNumber} className="week-card">
            <button
              className={`week-header ${expandedWeek === weekIndex ? 'expanded' : ''}`}
              onClick={() => setExpandedWeek(expandedWeek === weekIndex ? null : weekIndex)}
            >
              <div className="week-title">
                <h3>{week.name}</h3>
                {week.description && <p>{week.description}</p>}
              </div>
              <span className="expand-icon">{expandedWeek === weekIndex ? '−' : '+'}</span>
            </button>

            {expandedWeek === weekIndex && (
              <div className="week-days">
                {week.days.map((day: WorkoutDay, dayIndex: number) => (
                  <div
                    key={day.id}
                    className={`day-card ${isWorkoutCompleted(day.id) ? 'completed' : ''} ${
                      isCurrentWorkout(weekIndex, dayIndex) ? 'current' : ''
                    }`}
                  >
                    <div className="day-info">
                      <h4>{day.name}</h4>
                      {day.description && <p>{day.description}</p>}
                      <span className="exercise-count">{day.exercises.length} exercises</span>
                    </div>
                    <div className="day-status">
                      {isWorkoutCompleted(day.id) && <span className="status-badge completed">✓</span>}
                      {isCurrentWorkout(weekIndex, dayIndex) && !isWorkoutCompleted(day.id) && (
                        <button onClick={() => navigate('/workout')} className="btn btn-small">
                          Start
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
