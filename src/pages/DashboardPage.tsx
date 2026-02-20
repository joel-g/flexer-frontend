import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { analyticsApi } from '../services/api';
import { changelog } from '../data/changelog';
import { ResponsiveLayout } from '../components/ResponsiveLayout';
import type { PlanResponse, WorkoutProgress, WorkoutDay, ConsistencyAnalytics } from '../types/workout';

export function DashboardPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [progress, setProgress] = useState<WorkoutProgress | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Check onboarding status first
      const statusRes = await api.get<{ completed: boolean }>('/profile/onboarding-status');
      if (statusRes.success && !statusRes.data?.completed) {
        navigate('/onboarding');
        return;
      }

      // Load active plan
      const plansRes = await api.get<{ plans: PlanResponse[] }>('/plans?active=true');
      if (plansRes.success && plansRes.data?.plans.length) {
        setPlan(plansRes.data.plans[0]);
      }

      // Load progress
      const progressRes = await api.get<WorkoutProgress>('/progress');
      if (progressRes.success && progressRes.data) {
        setProgress(progressRes.data);
      }

      // Load consistency analytics
      const consistencyRes = await analyticsApi.getConsistency(28);
      if (consistencyRes.success && consistencyRes.data) {
        setConsistency(consistencyRes.data);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getCurrentWorkout(): WorkoutDay | null {
    if (!plan || !progress) return null;
    const week = plan.planData.weeks[progress.currentWeek];
    if (!week) return null;
    return week.days[progress.currentDay] || null;
  }

  function getProgressPercentage(): number {
    if (!plan || !progress) return 0;
    const totalWorkouts = plan.planData.weeks.reduce((sum, w) => sum + w.days.length, 0);
    return Math.round((progress.completedWorkouts.length / totalWorkouts) * 100);
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="dashboard-page">
          <div className="loading-spinner">Loading...</div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (error) {
    return (
      <ResponsiveLayout>
        <div className="dashboard-page">
          <div className="error-message">{error}</div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (!plan) {
    return (
      <ResponsiveLayout>
        <div className="dashboard-page">
          <div className="no-plan">
            <h2>No Active Plan</h2>
            <p>Complete onboarding to generate your personalized workout plan.</p>
            <button onClick={() => navigate('/onboarding')} className="btn btn-primary">
              Get Started
            </button>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  const currentWorkout = getCurrentWorkout();
  const progressPct = getProgressPercentage();

  return (
    <ResponsiveLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <h1>Dashboard</h1>
        </header>

      <section className="plan-summary">
        <h2>{plan.name}</h2>
        <p>{plan.description}</p>

        <div className="progress-bar-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="progress-text">{progressPct}% Complete</span>
        </div>

        <div className="plan-stats">
          <div className="stat">
            <span className="stat-value">Week {(progress?.currentWeek || 0) + 1}</span>
            <span className="stat-label">of {plan.planData.weeks.length}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{progress?.completedWorkouts.length || 0}</span>
            <span className="stat-label">Workouts Done</span>
          </div>
        </div>
      </section>

      {consistency && (
        <section className="consistency-section">
          <div className="consistency-header">
            <h3>Your Consistency</h3>
            <span className="consistency-period">Last 28 days</span>
          </div>
          <div className="consistency-cards">
            <div className="consistency-score-card">
              <div
                className="score-circle"
                style={{
                  background: `conic-gradient(
                    var(--color-primary) ${consistency.consistencyScore * 3.6}deg,
                    var(--color-border) 0deg
                  )`
                }}
              >
                <div className="score-inner">
                  <span className="score-value">{consistency.consistencyScore}</span>
                </div>
              </div>
              <span className="consistency-label">Score</span>
              {consistency.delta !== null && consistency.delta !== 0 && (
                <span className={`consistency-delta ${consistency.delta > 0 ? 'positive' : 'negative'}`}>
                  {consistency.delta > 0 ? '+' : ''}{consistency.delta}
                </span>
              )}
            </div>
            <div className="streak-card">
              <span className="streak-value">{consistency.currentStreakDays}</span>
              <span className="streak-label">Day Streak</span>
              {consistency.longestStreakDays > consistency.currentStreakDays && (
                <span className="streak-best">Best: {consistency.longestStreakDays}</span>
              )}
            </div>
          </div>
        </section>
      )}

      {currentWorkout && (
        <section className="next-workout">
          <h3>Next Workout</h3>
          <div className="workout-preview">
            <h4>{currentWorkout.name}</h4>
            {currentWorkout.description && <p>{currentWorkout.description}</p>}
            <div className="workout-meta">
              <span>{currentWorkout.exercises.length} exercises</span>
              {currentWorkout.estimatedDuration && (
                <span>~{currentWorkout.estimatedDuration} min</span>
              )}
            </div>
            <button onClick={() => navigate('/workout')} className="btn btn-primary btn-large">
              Start Workout
            </button>
          </div>
        </section>
      )}

      <section className="quick-actions">
        <button onClick={() => navigate('/history')} className="btn btn-secondary">
          View History
        </button>
        <button onClick={() => navigate('/plan')} className="btn btn-secondary">
          View Full Plan
        </button>
        <button onClick={() => navigate('/profile')} className="btn btn-secondary">
          Profile Settings
        </button>
      </section>

      <footer className="dashboard-footer">
        <div className="footer-links">
          <a
            href="/privacy"
            className="footer-link"
            onClick={(e) => {
              e.preventDefault();
              navigate('/privacy');
            }}
          >
            Privacy Policy
          </a>
          <span className="footer-divider">•</span>
          <a
            href="/terms"
            className="footer-link"
            onClick={(e) => {
              e.preventDefault();
              navigate('/terms');
            }}
          >
            Terms of Service
          </a>
          <span className="footer-divider">•</span>
          <button
            className="footer-link changelog-toggle"
            onClick={() => setChangelogOpen(!changelogOpen)}
          >
            Changelog {changelogOpen ? '▲' : '▼'}
          </button>
        </div>
        
        {changelogOpen && (
          <div className="changelog-panel">
            <div className="changelog-header">
              <span className="beta-badge">BETA</span>
              <span>What's New</span>
            </div>
            {changelog.map((entry) => (
              <div key={entry.version} className="changelog-entry">
                <div className="changelog-version">
                  <strong>v{entry.version}</strong>
                  <span className="changelog-date">{entry.date}</span>
                </div>
                <ul className="changelog-changes">
                  {entry.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <p className="privacy-note">
          Your personal information is securely stored and never shared with third parties.
        </p>
      </footer>
      </div>
    </ResponsiveLayout>
  );
}
