import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { analyticsApi } from "../services/api";
import { changelog } from "../data/changelog";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { AppIcon } from "../components/AppIcon";
import type {
  PlanResponse,
  WorkoutProgress,
  ConsistencyAnalytics,
} from "../types/workout";

export function DashboardPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [progress, setProgress] = useState<WorkoutProgress | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyAnalytics | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsUnavailable, setAnalyticsUnavailable] = useState(false);
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalyticsUnavailable(false);
    try {
      const status = await api.get<{ completed: boolean }>(
        "/profile/onboarding-status",
      );
      if (!status.success || !status.data)
        throw new Error("Your account could not be loaded. Please try again.");
      if (!status.data.completed) {
        navigate("/onboarding", { replace: true });
        return;
      }
      const [plansRes, progressRes] = await Promise.all([
        api.get<{ plans: PlanResponse[] }>("/plans?active=true"),
        api.get<WorkoutProgress>("/progress"),
      ]);
      if (
        !plansRes.success ||
        !plansRes.data ||
        !progressRes.success ||
        !progressRes.data
      )
        throw new Error(
          "Your training plan could not be loaded. Your saved workouts have not changed.",
        );
      setPlan(plansRes.data.plans[0] ?? null);
      setProgress(progressRes.data);
      try {
        const result = await analyticsApi.getConsistency(28);
        setConsistency(result.success && result.data ? result.data : null);
        setAnalyticsUnavailable(!result.success || !result.data);
      } catch {
        setConsistency(null);
        setAnalyticsUnavailable(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your training. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [api, navigate]);
  useEffect(() => {
    void loadData();
  }, [loadData]);
  const workout =
    plan && progress
      ? plan.planData.weeks[progress.currentWeek]?.days[progress.currentDay]
      : null;
  const totalWorkouts =
    plan?.planData.weeks.reduce((sum, w) => sum + w.days.length, 0) ?? 0;
  const planDayIds = new Set(
    plan?.planData.weeks.flatMap((w) => w.days.map((d) => d.id)) ?? [],
  );
  const completed = new Set(
    progress?.completedWorkouts.filter((id) => planDayIds.has(id)) ?? [],
  ).size;
  const percentage = totalWorkouts
    ? Math.min(100, Math.round((completed / totalWorkouts) * 100))
    : 0;
  const resuming =
    workout &&
    progress?.currentWorkoutProgress?.workoutId === workout.id &&
    progress.currentWorkoutProgress.completedSets.length > 0;
  return (
    <ResponsiveLayout>
      <div className="dashboard-page training-dashboard">
        <header className="training-page-heading">
          <div>
            <p className="training-eyebrow">YOUR NEXT SESSION</p>
            <h1>Make time. Make progress.</h1>
          </div>
          {plan && (
            <Link to="/plan" className="btn btn-secondary">
              View my plan <AppIcon name="arrow" size={18} />
            </Link>
          )}
        </header>
        {loading ? (
          <section className="training-state" role="status">
            <div className="spinner" aria-hidden="true" />
            <h2>Getting your training ready</h2>
            <p>Loading your plan and saved progress…</p>
          </section>
        ) : error ? (
          <section className="training-state">
            <h2>Let’s try that again.</h2>
            <p className="error-message" role="alert">
              {error}
            </p>
            <button onClick={() => void loadData()} className="btn btn-primary">
              Retry loading
            </button>
          </section>
        ) : !plan ? (
          <section className="training-state">
            <p className="training-eyebrow">A FRESH START</p>
            <h2>Your next chapter starts with a plan.</h2>
            <p>
              Build a prompt around your goals, then import your training plan.
            </p>
            <Link to="/onboarding" className="btn btn-primary">
              Build a plan <AppIcon name="arrow" />
            </Link>
          </section>
        ) : (
          <>
            <div className="training-dashboard-grid">
              <section className="training-hero">
                <div className="training-hero-top">
                  <span className="training-chip">
                    {resuming ? "IN PROGRESS" : "UP NEXT"}
                  </span>
                  <span>
                    WEEK {(progress?.currentWeek ?? 0) + 1} / SESSION{" "}
                    {(progress?.currentDay ?? 0) + 1}
                  </span>
                </div>
                <h2>{workout?.name ?? "Your plan is ready to review."}</h2>
                <p>
                  {workout?.description ||
                    "Show up for yourself. One set at a time."}
                </p>
                {workout && (
                  <div className="training-hero-stats">
                    <div>
                      <strong>
                        {workout.estimatedDuration ?? "—"}
                        <small> MIN</small>
                      </strong>
                      <span>Estimated time</span>
                    </div>
                    <div>
                      <strong>{workout.exercises.length}</strong>
                      <span>Exercises</span>
                    </div>
                    <div>
                      <strong>
                        {workout.exercises.reduce((n, e) => n + e.sets, 0)}
                      </strong>
                      <span>Working sets</span>
                    </div>
                  </div>
                )}
                <div className="training-hero-bottom">
                  <Link
                    className="btn btn-primary"
                    to={workout ? "/workout" : "/plan"}
                  >
                    {workout
                      ? resuming
                        ? "Resume workout"
                        : "Start workout"
                      : "Review my plan"}
                    <AppIcon name="arrow" />
                  </Link>
                  <span>One set at a time.</span>
                </div>
                <div className="training-hero-lines" aria-hidden="true" />
              </section>
              <section className="training-plan-card">
                <p className="training-eyebrow">YOUR TRAINING PLAN</p>
                <h2>{plan.name}</h2>
                <p>{plan.description}</p>
                <div className="training-plan-progress">
                  <strong>{percentage}%</strong>
                  <span>
                    {completed} of {totalWorkouts} sessions completed
                  </span>
                </div>
                <progress
                  value={completed}
                  max={totalWorkouts || 1}
                  aria-label="Plan sessions completed"
                />
                <Link to="/plan" className="training-text-link">
                  Explore your sessions <AppIcon name="arrow" size={18} />
                </Link>
              </section>
            </div>
            {workout && (
              <section className="training-exercise-section">
                <div className="training-section-heading">
                  <h2>Inside this workout</h2>
                  <span>
                    {workout.exercises.length} exercises · circuit format
                  </span>
                </div>
                <div className="training-exercise-table">
                  {workout.exercises.map((exercise, i) => (
                    <div className="training-exercise-row" key={exercise.id}>
                      <span className="training-exercise-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3>{exercise.name}</h3>
                        <span>
                          {exercise.loadType?.replaceAll("_", " ") ||
                            "Exercise"}
                        </span>
                      </div>
                      <span className="training-prescription">
                        {exercise.sets} × {exercise.reps}
                      </span>
                      <span className="training-rest-meta">
                        <AppIcon name="clock" size={15} />
                        {exercise.restSeconds ?? 60}s rest
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {consistency && (
              <section className="training-consistency">
                <div>
                  <p className="training-eyebrow">LAST 28 DAYS</p>
                  <h2>Keep finding your rhythm.</h2>
                  <Link to="/history" className="training-text-link">
                    View training history <AppIcon name="arrow" size={18} />
                  </Link>
                </div>
                <dl>
                  <div>
                    <dt>Consistency score</dt>
                    <dd>
                      {consistency.consistencyScore}
                      <small>/100</small>
                    </dd>
                    {consistency.delta !== null && consistency.delta !== 0 && (
                      <small>{consistency.delta > 0 ? '+' : ''}{consistency.delta} vs previous period</small>
                    )}
                  </div>
                  <div>
                    <dt>Current streak</dt>
                    <dd>
                      {consistency.currentStreakDays}
                      <small> days</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Longest streak</dt>
                    <dd>
                      {consistency.longestStreakDays}
                      <small> days</small>
                    </dd>
                  </div>
                </dl>
              </section>
            )}
            {analyticsUnavailable && (
              <p role="status" className="training-inline-note">
                Your plan is ready. Progress insights are temporarily
                unavailable; you can still train.
              </p>
            )}
            <div className="training-plan-banner">
              <div>
                <p className="training-eyebrow">BUILT AROUND YOU</p>
                <h2>A plan should fit your life.</h2>
                <p>
                  Update your goals, equipment and preferences in your profile.
                </p>
              </div>
              <Link className="btn btn-secondary" to="/profile">
                Your profile <AppIcon name="arrow" size={18} />
              </Link>
            </div>
          </>
        )}
        <footer className="training-footer">
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/history">History</Link>
          </div>
          <details>
            <summary>What’s new</summary>
            {changelog.map((entry) => (
              <section key={entry.version}>
                <h3>
                  v{entry.version} <small>{entry.date}</small>
                </h3>
                <ul>
                  {entry.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </section>
            ))}
          </details>
        </footer>
      </div>
    </ResponsiveLayout>
  );
}
