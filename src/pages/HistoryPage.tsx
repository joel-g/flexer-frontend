import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { historyApi, analyticsApi } from '../services/api';
import { ResponsiveLayout } from '../components/ResponsiveLayout';
import type { HistoryAnalytics, SessionListItem, ConsistencyAnalytics } from '../types/workout';
import './HistoryPage.css';

type RangeOption = 28 | 56 | 84;

export function HistoryPage() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<HistoryAnalytics | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyAnalytics | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeOption>(56);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  const loadData = useCallback(async (range: RangeOption) => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsRes, sessionsRes, consistencyRes] = await Promise.all([
        historyApi.getAnalytics(range),
        historyApi.listSessions({ limit: 10 }),
        analyticsApi.getConsistency(28),
      ]);

      if (analyticsRes.success && analyticsRes.data) {
        setAnalytics(analyticsRes.data);
      } else {
        setError(analyticsRes.error || 'Failed to load analytics');
      }

      if (sessionsRes.success && sessionsRes.data) {
        setSessions(sessionsRes.data.items);
        setNextCursor(sessionsRes.data.nextCursor);
      }

      if (consistencyRes.success && consistencyRes.data) {
        setConsistency(consistencyRes.data);
      }
    } catch (err) {
      setError('Failed to load history data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(rangeDays);
  }, [rangeDays, loadData]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;

    try {
      setLoadingMore(true);
      const res = await historyApi.listSessions({ limit: 10, cursor: nextCursor });
      if (res.success && res.data) {
        setSessions(prev => [...prev, ...res.data!.items]);
        setNextCursor(res.data.nextCursor);
      }
    } catch (err) {
      console.error('Failed to load more sessions', err);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleRangeChange(range: RangeOption) {
    setRangeDays(range);
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function formatDateFull(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="history-page">
          <div className="loading-spinner">Loading history...</div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (error) {
    return (
      <ResponsiveLayout>
        <div className="history-page">
          <div className="error-message">{error}</div>
          <button onClick={() => loadData(rangeDays)} className="btn btn-secondary">
            Try Again
          </button>
        </div>
      </ResponsiveLayout>
    );
  }

  const maxWeeklyValue = analytics
    ? Math.max(...analytics.weeklySeries.map(w => w.completed), 1)
    : 1;

  return (
    <ResponsiveLayout>
      <div className="history-page">
        <header className="history-header">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            &larr; Back
          </button>
          <h1>Workout History</h1>
        </header>

        {/* Range Filter */}
        <div className="range-filter">
          {([28, 56, 84] as RangeOption[]).map(range => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={`range-btn ${rangeDays === range ? 'active' : ''}`}
            >
              {range / 7}w
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        {analytics && (
          <section className="summary-cards">
            <div className="summary-card">
              <span className="summary-value">{analytics.summary.totalCompleted}</span>
              <span className="summary-label">Workouts</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{analytics.summary.currentStreakDays}</span>
              <span className="summary-label">Day Streak</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">
                {analytics.summary.completionRate !== null
                  ? `${Math.round(analytics.summary.completionRate * 100)}%`
                  : '-'}
              </span>
              <span className="summary-label">Completion</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">
                {analytics.summary.estimatedTotalSets || '-'}
              </span>
              <span className="summary-label">Total Sets</span>
            </div>
          </section>
        )}

        {/* Week over Week */}
        {analytics && (
          <section className="week-over-week">
            <h3>This Week</h3>
            <div className="wow-content">
              <span className="wow-value">{analytics.weekOverWeek.thisWeekCompleted}</span>
              <span className="wow-label">workouts</span>
              {analytics.weekOverWeek.delta !== 0 && (
                <span className={`wow-delta ${analytics.weekOverWeek.delta > 0 ? 'positive' : 'negative'}`}>
                  {analytics.weekOverWeek.delta > 0 ? '+' : ''}{analytics.weekOverWeek.delta} vs last week
                </span>
              )}
            </div>
          </section>
        )}

        {/* Weekly Trend Chart */}
        {analytics && analytics.weeklySeries.length > 0 && (
          <section className="trend-chart">
            <h3>Weekly Activity</h3>
            <div className="chart-container">
              {analytics.weeklySeries.map((week, index) => (
                <div key={week.weekStart} className="chart-bar-wrapper">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(week.completed / maxWeeklyValue) * 100}%`,
                      minHeight: week.completed > 0 ? '4px' : '0',
                    }}
                  >
                    {week.completed > 0 && (
                      <span className="chart-bar-value">{week.completed}</span>
                    )}
                  </div>
                  <span className="chart-label">
                    {index === analytics.weeklySeries.length - 1
                      ? 'This'
                      : formatDate(week.weekStart)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Enhanced Metrics (if available) */}
        {analytics && analytics.metricTier === 'enhanced' && analytics.summary.actualTotalVolume && (
          <section className="enhanced-metrics">
            <div className="metric-badge">Enhanced</div>
            <div className="metric-row">
              <span className="metric-label">Total Volume</span>
              <span className="metric-value">
                {Math.round(analytics.summary.actualTotalVolume).toLocaleString()} kg
              </span>
            </div>
          </section>
        )}

        {/* Longest Streak */}
        {analytics && analytics.summary.longestStreakDays > 0 && (
          <section className="longest-streak">
            <span className="streak-label">Longest streak:</span>
            <span className="streak-value">{analytics.summary.longestStreakDays} days</span>
          </section>
        )}

        {/* Consistency Score Breakdown */}
        {consistency && (
          <section className="consistency-breakdown">
            <button
              className="breakdown-toggle"
              onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
            >
              <div className="breakdown-toggle-content">
                <span className="breakdown-label">Consistency Score</span>
                <span className="breakdown-score">{consistency.consistencyScore}/100</span>
              </div>
              <span className="breakdown-chevron">{showScoreBreakdown ? '▲' : '▼'}</span>
            </button>
            {showScoreBreakdown && (
              <div className="breakdown-details">
                <div className="breakdown-item">
                  <div className="breakdown-item-header">
                    <span className="breakdown-item-label">Adherence Rate</span>
                    <span className="breakdown-item-value">
                      {Math.round(consistency.components.adherenceRate * 100)}%
                    </span>
                  </div>
                  <div className="breakdown-bar">
                    <div
                      className="breakdown-bar-fill"
                      style={{ width: `${consistency.components.adherenceRate * 100}%` }}
                    />
                  </div>
                  <span className="breakdown-item-detail">
                    {consistency.components.completedWorkouts} of {consistency.components.scheduledWorkouts} workouts (60% weight)
                  </span>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-item-header">
                    <span className="breakdown-item-label">Streak Strength</span>
                    <span className="breakdown-item-value">
                      {Math.round(consistency.components.streakStrength * 100)}%
                    </span>
                  </div>
                  <div className="breakdown-bar">
                    <div
                      className="breakdown-bar-fill"
                      style={{ width: `${consistency.components.streakStrength * 100}%` }}
                    />
                  </div>
                  <span className="breakdown-item-detail">
                    {consistency.currentStreakDays} day streak / 7 day goal (25% weight)
                  </span>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-item-header">
                    <span className="breakdown-item-label">Recency Bonus</span>
                    <span className="breakdown-item-value">
                      {Math.round(consistency.components.recencyBonus * 100)}%
                    </span>
                  </div>
                  <div className="breakdown-bar">
                    <div
                      className="breakdown-bar-fill"
                      style={{ width: `${consistency.components.recencyBonus * 100}%` }}
                    />
                  </div>
                  <span className="breakdown-item-detail">
                    {consistency.components.recencyBonus === 1
                      ? 'Worked out recently'
                      : consistency.components.recencyBonus > 0
                      ? 'A few days since last workout'
                      : 'No recent workouts'} (15% weight)
                  </span>
                </div>
                {consistency.delta !== null && consistency.delta !== 0 && (
                  <div className="breakdown-delta">
                    <span className={consistency.delta > 0 ? 'positive' : 'negative'}>
                      {consistency.delta > 0 ? '+' : ''}{consistency.delta} points
                    </span>
                    {' '}vs previous period
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Session List */}
        <section className="session-list">
          <h3>Recent Workouts</h3>
          {sessions.length === 0 ? (
            <div className="empty-state">
              <p>No completed workouts yet.</p>
              <p>Start a workout to see your history here!</p>
            </div>
          ) : (
            <>
              {sessions.map(session => (
                <div key={session.id} className="session-item">
                  <div className="session-main">
                    <span className="session-name">{session.workoutName}</span>
                    <span className="session-date">
                      {session.completedAt ? formatDateFull(session.completedAt) : '-'}
                    </span>
                  </div>
                  <div className="session-meta">
                    <span>Week {session.weekNumber + 1}, Day {session.dayNumber + 1}</span>
                    <span>{formatDuration(session.durationSeconds)}</span>
                    {session.totalSetsCompleted && (
                      <span>{session.totalSetsCompleted} sets</span>
                    )}
                  </div>
                </div>
              ))}
              {nextCursor && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn btn-secondary load-more-btn"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </ResponsiveLayout>
  );
}
