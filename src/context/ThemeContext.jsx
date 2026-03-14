// src/context/ThemeContext.jsx
// Persistent dark/light mode — survives refresh and page navigation.
// Usage: wrap app in <ThemeProvider>, then call useTheme() anywhere.
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    // Initialise from localStorage; default to dark if never set
    const saved = localStorage.getItem('neu-theme');
    return saved ? saved === 'dark' : true;
  });

  // Keep <html data-theme> and localStorage in sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('neu-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
