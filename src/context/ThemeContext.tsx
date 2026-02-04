import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { themes, type ThemeId, type Theme } from '../data/themes';

interface ThemeContextType {
  theme: Theme;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'flexer-theme';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    // Load from localStorage on initial render
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && themes[saved as ThemeId]) {
      return saved as ThemeId;
    }
    return 'default';
  });

  const theme = themes[themeId];

  useEffect(() => {
    // Apply theme to document on mount and when theme changes
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId, theme]);

  function setTheme(id: ThemeId) {
    if (themes[id]) {
      setThemeId(id);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
