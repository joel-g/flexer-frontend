export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    // Primary brand colors
    '--color-primary': string;
    '--color-primary-dark': string;
    '--color-primary-light': string;
    
    // Background colors
    '--color-bg-main': string;
    '--color-bg-card': string;
    '--color-bg-card-alt': string;
    '--color-bg-input': string;
    
    // Text colors - carefully chosen for contrast
    '--color-text-primary': string;
    '--color-text-secondary': string;
    '--color-text-muted': string;
    '--color-text-inverse': string;
    
    // Border colors
    '--color-border': string;
    '--color-border-light': string;
    
    // Semantic colors
    '--color-success': string;
    '--color-success-dark': string;
    '--color-error': string;
    '--color-error-dark': string;
    '--color-error-bg': string;
    '--color-warning': string;
    
    // Gradient for headers/buttons
    '--gradient-primary': string;
  };
  // Preview colors for the theme picker
  preview: {
    primary: string;
    background: string;
    card: string;
  };
}

export const themes: Record<string, Theme> = {
  default: {
    id: 'default',
    name: 'Flexer Classic',
    description: 'The original purple gradient theme',
    colors: {
      '--color-primary': '#667eea',
      '--color-primary-dark': '#764ba2',
      '--color-primary-light': '#f0f4ff',
      '--color-bg-main': '#f5f7fa',
      '--color-bg-card': '#ffffff',
      '--color-bg-card-alt': '#f8fafc',
      '--color-bg-input': '#ffffff',
      '--color-text-primary': '#2d3748',
      '--color-text-secondary': '#4a5568',
      '--color-text-muted': '#718096',
      '--color-text-inverse': '#ffffff',
      '--color-border': '#e2e8f0',
      '--color-border-light': '#e1e5e9',
      '--color-success': '#48bb78',
      '--color-success-dark': '#38a169',
      '--color-error': '#e53e3e',
      '--color-error-dark': '#c53030',
      '--color-error-bg': '#fed7d7',
      '--color-warning': '#ed8936',
      '--gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    preview: {
      primary: '#667eea',
      background: '#f5f7fa',
      card: '#ffffff',
    },
  },

  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Easy on the eyes for late-night workouts',
    colors: {
      '--color-primary': '#818cf8',
      '--color-primary-dark': '#6366f1',
      '--color-primary-light': '#1e1b4b',
      '--color-bg-main': '#0f172a',
      '--color-bg-card': '#1e293b',
      '--color-bg-card-alt': '#334155',
      '--color-bg-input': '#1e293b',
      '--color-text-primary': '#f1f5f9',
      '--color-text-secondary': '#cbd5e1',
      '--color-text-muted': '#94a3b8',
      '--color-text-inverse': '#0f172a',
      '--color-border': '#334155',
      '--color-border-light': '#475569',
      '--color-success': '#4ade80',
      '--color-success-dark': '#22c55e',
      '--color-error': '#f87171',
      '--color-error-dark': '#ef4444',
      '--color-error-bg': '#450a0a',
      '--color-warning': '#fbbf24',
      '--gradient-primary': 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
    },
    preview: {
      primary: '#818cf8',
      background: '#0f172a',
      card: '#1e293b',
    },
  },

  ocean: {
    id: 'ocean',
    name: 'Ocean Breeze',
    description: 'Cool blues for a calming workout',
    colors: {
      '--color-primary': '#0ea5e9',
      '--color-primary-dark': '#0284c7',
      '--color-primary-light': '#e0f2fe',
      '--color-bg-main': '#f0f9ff',
      '--color-bg-card': '#ffffff',
      '--color-bg-card-alt': '#e0f2fe',
      '--color-bg-input': '#ffffff',
      '--color-text-primary': '#0c4a6e',
      '--color-text-secondary': '#075985',
      '--color-text-muted': '#0369a1',
      '--color-text-inverse': '#ffffff',
      '--color-border': '#bae6fd',
      '--color-border-light': '#e0f2fe',
      '--color-success': '#10b981',
      '--color-success-dark': '#059669',
      '--color-error': '#ef4444',
      '--color-error-dark': '#dc2626',
      '--color-error-bg': '#fee2e2',
      '--color-warning': '#f59e0b',
      '--gradient-primary': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    },
    preview: {
      primary: '#0ea5e9',
      background: '#f0f9ff',
      card: '#ffffff',
    },
  },

  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Earthy greens for nature lovers',
    colors: {
      '--color-primary': '#059669',
      '--color-primary-dark': '#047857',
      '--color-primary-light': '#d1fae5',
      '--color-bg-main': '#f0fdf4',
      '--color-bg-card': '#ffffff',
      '--color-bg-card-alt': '#dcfce7',
      '--color-bg-input': '#ffffff',
      '--color-text-primary': '#14532d',
      '--color-text-secondary': '#166534',
      '--color-text-muted': '#15803d',
      '--color-text-inverse': '#ffffff',
      '--color-border': '#a7f3d0',
      '--color-border-light': '#d1fae5',
      '--color-success': '#10b981',
      '--color-success-dark': '#059669',
      '--color-error': '#ef4444',
      '--color-error-dark': '#dc2626',
      '--color-error-bg': '#fee2e2',
      '--color-warning': '#f59e0b',
      '--gradient-primary': 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    },
    preview: {
      primary: '#059669',
      background: '#f0fdf4',
      card: '#ffffff',
    },
  },

  sunset: {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm oranges and reds to energize',
    colors: {
      '--color-primary': '#f97316',
      '--color-primary-dark': '#ea580c',
      '--color-primary-light': '#ffedd5',
      '--color-bg-main': '#fffbeb',
      '--color-bg-card': '#ffffff',
      '--color-bg-card-alt': '#fef3c7',
      '--color-bg-input': '#ffffff',
      '--color-text-primary': '#78350f',
      '--color-text-secondary': '#92400e',
      '--color-text-muted': '#b45309',
      '--color-text-inverse': '#ffffff',
      '--color-border': '#fed7aa',
      '--color-border-light': '#ffedd5',
      '--color-success': '#22c55e',
      '--color-success-dark': '#16a34a',
      '--color-error': '#dc2626',
      '--color-error-dark': '#b91c1c',
      '--color-error-bg': '#fee2e2',
      '--color-warning': '#eab308',
      '--gradient-primary': 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    },
    preview: {
      primary: '#f97316',
      background: '#fffbeb',
      card: '#ffffff',
    },
  },

  slate: {
    id: 'slate',
    name: 'Slate',
    description: 'Modern dark theme with subtle contrast',
    colors: {
      '--color-primary': '#a78bfa',
      '--color-primary-dark': '#8b5cf6',
      '--color-primary-light': '#2e1065',
      '--color-bg-main': '#1c1917',
      '--color-bg-card': '#292524',
      '--color-bg-card-alt': '#3f3f46',
      '--color-bg-input': '#292524',
      '--color-text-primary': '#fafaf9',
      '--color-text-secondary': '#e7e5e4',
      '--color-text-muted': '#a8a29e',
      '--color-text-inverse': '#1c1917',
      '--color-border': '#44403c',
      '--color-border-light': '#57534e',
      '--color-success': '#86efac',
      '--color-success-dark': '#4ade80',
      '--color-error': '#fca5a5',
      '--color-error-dark': '#f87171',
      '--color-error-bg': '#450a0a',
      '--color-warning': '#fcd34d',
      '--gradient-primary': 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
    },
    preview: {
      primary: '#a78bfa',
      background: '#1c1917',
      card: '#292524',
    },
  },
};

export const themeIds = Object.keys(themes);
export type ThemeId = keyof typeof themes;
