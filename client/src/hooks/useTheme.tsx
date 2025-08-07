


import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';

export type ThemeName = 'theme-indigo' | 'theme-crimson' | 'theme-forest' | 'theme-ocean' | 'theme-amber' | 'theme-cyan' | 'theme-violet';
export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeName>(() => {
    return (localStorage.getItem('messenger_app_theme') as ThemeName) || 'theme-indigo';
  });
  
  const [mode, setMode] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem('messenger_theme_mode') as ThemeMode;
    if (savedMode) return savedMode;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Clear old theme classes by removing any class that starts with 'theme-'
    const themeClasses = Array.from(root.classList).filter(c => c.startsWith('theme-'));
    root.classList.remove(...themeClasses, 'light', 'dark');

    // Add the new classes
    root.classList.add(mode, theme);
    localStorage.setItem('messenger_app_theme', theme);
    localStorage.setItem('messenger_theme_mode', mode);
  }, [theme, mode]);
  
  const toggleMode = () => {
    setMode(prevMode => prevMode === 'light' ? 'dark' : 'light');
  };

  const value = useMemo(() => ({ theme, setTheme, mode, setMode, toggleMode }), [theme, mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};