export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '0.10.0',
    date: 'February 20, 2026',
    changes: [
      'Consistency Score: see your 0-100 adherence score on the dashboard',
      'Score breakdown showing adherence rate, streak strength, and recency bonus',
      'Track score changes vs previous period',
      'Streak display on dashboard with personal best',
    ],
  },
  {
    version: '0.9.0',
    date: 'February 19, 2026',
    changes: [
      'Workout History page with analytics dashboard',
      'Track streaks, completion rate, and total volume',
      'Weekly activity chart showing workout trends',
      'View past workouts with duration and set counts',
    ],
  },
  {
    version: '0.8.0',
    date: 'February 13, 2026',
    changes: [
      'In-workout set logging: track actual reps and weight for each set',
      'Smart input fields based on exercise type (weights, bands, timed, distance)',
      'Session tracking for workout history foundation',
    ],
  },
  {
    version: '0.7.0',
    date: 'February 11, 2026',
    changes: [
      'Added Terms of Service with AI workout liability disclaimer',
      'Fixed plan import failing when copied from ChatGPT due to smart/curly quotes',
      'Plan import now handles markdown code fences added by some AI assistants',
    ],
  },
  {
    version: '0.6.0',
    date: 'February 4, 2026',
    changes: [
      'Account deletion with full data removal',
      'Delete personal details, workout history, and health information',
      'Clear messaging about data retention policy',
    ],
  },
  {
    version: '0.5.0',
    date: 'February 4, 2026',
    changes: [
      'Responsive desktop UI for signup and plan generation',
      'Desktop header with profile menu and navigation',
      'Privacy policy and changelog visible during onboarding',
      'Improved layouts for larger screens',
    ],
  },
  {
    version: '0.4.0',
    date: 'February 3, 2026',
    changes: [
      'Added 6 color themes including dark modes',
      'Theme picker in Profile settings',
      'All pages now support theming',
    ],
  },
  {
    version: '0.3.0',
    date: 'February 3, 2026',
    changes: [
      'Added privacy policy page',
      'Added changelog to dashboard footer',
      'Improved data security messaging',
    ],
  },
  {
    version: '0.2.0',
    date: 'February 1, 2026',
    changes: [
      'Workout tracking and progress persistence',
      'Rest timer between sets',
      'Plan overview page with weekly breakdown',
      'Profile settings page',
    ],
  },
  {
    version: '0.1.0',
    date: 'January 28, 2026',
    changes: [
      'Initial beta release',
      'User onboarding flow',
      'AI-powered workout plan generation',
      'Basic workout display',
    ],
  },
];
