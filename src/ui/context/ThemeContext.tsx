import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeId = 'slate' | 'aero' | 'midnight';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  preview: { sidebar: string; surface: string; accent: string };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'slate',
    label: 'Slate',
    description: 'Light canvas with dark slate sidebar',
    preview: { sidebar: '#1e2333', surface: '#ffffff', accent: '#4a7bc8' },
  },
  {
    id: 'aero',
    label: 'Aero',
    description: 'Vista-inspired dark glass with ice-blue accents',
    preview: { sidebar: '#0a0e1a', surface: '#121828', accent: '#38b4f0' },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'OLED-dark with deep indigo accent',
    preview: { sidebar: '#07070f', surface: '#0f0f1a', accent: '#8b5cf6' },
  },
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'slate',
  setTheme: () => {},
});

const STORAGE_KEY = 'mtt:theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return stored && THEMES.some((t) => t.id === stored) ? stored : 'slate';
  });

  useEffect(() => {
    if (theme === 'slate') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
