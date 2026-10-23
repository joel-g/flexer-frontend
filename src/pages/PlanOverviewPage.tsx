import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import type {
  PlanResponse,
  WorkoutProgress,
  WorkoutWeek,
  WorkoutDay,
} from "../types/workout";

export function PlanOverviewPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [progress, setProgress] = useState<WorkoutProgress | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingDay, setUpdatingDay] = useState<string | null>(null);
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, progressRes] = await Promise.all([
        api.get<{ plans: PlanResponse[] }>("/plans?active=true"),
        api.get<WorkoutProgress>("/progress"),
      ]);
      if (
        !plansRes.success ||
        !plansRes.data ||
        !progressRes.success ||
        !progressRes.data
      ) {
        throw new Error("Your plan could not be loaded. Please try again.");
      }
      setPlan(plansRes.data.plans[0] ?? null);
      setProgress(progressRes.data);
      setExpandedWeek(progressRes.data.currentWeek);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your plan could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void loadData();
  }, [loadData]);
  function isWorkoutCompleted(dayId: string): boolean {
    return progress?.completedWorkouts.includes(dayId) || false;
  }

  function isCurrentWorkout(weekIndex: number, dayIndex: number): boolean {
    return (
      progress?.currentWeek === weekIndex && progress?.currentDay === dayIndex
    );
  }

  async function restartWorkout(dayId: string) {
    if (!progress || updatingDay || deleting) return;
    setUpdatingDay(dayId);
    setActionError(null);
    const newCompletedWorkouts = progress.completedWorkouts.filter(
      (id) => id !== dayId,
    );
    try {
      const result = await api.put("/progress", {
        currentWeek: progress.currentWeek,
        currentDay: progress.currentDay,
        completedWorkouts: newCompletedWorkouts,
      });
      if (!result.success)
        throw new Error("Unable to update this session. Please try again.");
      setProgress({ ...progress, completedWorkouts: newCompletedWorkouts });
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to update this session. Please try again.",
      );
    } finally {
      setUpdatingDay(null);
    }
  }
  async function handleDeletePlan() {
    if (!plan) return;
    if (
      !confirm(
        "Are you sure you want to delete your workout plan? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      const deleteRes = await api.delete(`/plans/${plan.id}`);

      if (!deleteRes.success) {
        throw new Error("Failed to delete plan");
      }

      // Clear local storage
      localStorage.removeItem("workout-progress");
      navigate("/onboarding");
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to delete your plan. Please try again.",
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="plan-page loading" role="status">
          Loading your plan…
        </div>
      </ResponsiveLayout>
    );
  }

  if (error) {
    return (
      <ResponsiveLayout>
        <div className="plan-page training-state">
          <h1>My plan</h1>
          <p role="alert" className="error-message">
            {error}
          </p>
          <button className="btn btn-primary" onClick={() => void loadData()}>
            Retry loading
          </button>
        </div>
      </ResponsiveLayout>
    );
  }
  if (!plan) {
    return (
      <ResponsiveLayout>
        <div className="plan-page">
          <div className="no-plan">
            <h1>Your next chapter starts with a plan.</h1>
            <p>No active plan found.</p>
            <button
              onClick={() => navigate("/onboarding")}
              className="btn btn-primary"
            >
              Create Plan
            </button>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="plan-page">
        <header className="plan-header">
          <button onClick={() => navigate("/dashboard")} className="back-btn">
            ← Back
          </button>
          <h1>{plan.name}</h1>
        </header>

        <p className="plan-description">{plan.description}</p>
        {actionError && (
          <p className="error-message" role="alert">
            {actionError}
          </p>
        )}

        <div className="weeks-list">
          {plan.planData.weeks.map((week: WorkoutWeek, weekIndex: number) => (
            <div key={week.weekNumber} className="week-card">
              <button
                className={`week-header ${expandedWeek === weekIndex ? "expanded" : ""}`}
                aria-expanded={expandedWeek === weekIndex}
                onClick={() =>
                  setExpandedWeek(expandedWeek === weekIndex ? null : weekIndex)
                }
              >
                <div className="week-title">
                  <h3>{week.name}</h3>
                  {week.description && <p>{week.description}</p>}
                </div>
                <span className="expand-icon">
                  {expandedWeek === weekIndex ? "−" : "+"}
                </span>
              </button>

              {expandedWeek === weekIndex && (
                <div className="week-days">
                  {week.days.map((day: WorkoutDay, dayIndex: number) => (
                    <div
                      key={day.id}
                      className={`day-card ${isWorkoutCompleted(day.id) ? "completed" : ""} ${
                        isCurrentWorkout(weekIndex, dayIndex) ? "current" : ""
                      }`}
                    >
                      <div className="day-info">
                        <h4>{day.name}</h4>
                        {day.description && <p>{day.description}</p>}
                        <span className="exercise-count">
                          {day.exercises.length} exercises
                        </span>
                      </div>
                      <div className="day-status">
                        {isWorkoutCompleted(day.id) && (
                          <>
                            <span className="status-badge completed">✓</span>
                            <button
                              onClick={() => restartWorkout(day.id)}
                              className="btn btn-small btn-ghost"
                              title="Mark as incomplete"
                              disabled={updatingDay !== null || deleting}
                            >
                              {updatingDay === day.id ? "Updating…" : "Restart"}
                            </button>
                          </>
                        )}
                        {isCurrentWorkout(weekIndex, dayIndex) &&
                          !isWorkoutCompleted(day.id) && (
                            <button
                              onClick={() => navigate("/workout")}
                              className="btn btn-small"
                            >
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

        <section className="plan-danger-zone">
          <h3>Danger Zone</h3>
          <p>
            Delete this plan and all progress to start fresh with a new plan.
          </p>
          <button
            onClick={handleDeletePlan}
            className="btn btn-danger"
            disabled={deleting || updatingDay !== null}
          >
            {deleting ? "Deleting..." : "Delete Plan"}
          </button>
        </section>
      </div>
    </ResponsiveLayout>
  );
}
