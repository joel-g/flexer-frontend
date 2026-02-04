export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
