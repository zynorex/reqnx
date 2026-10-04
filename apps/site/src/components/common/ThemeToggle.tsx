// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/components/common/ThemeToggle.tsx
//
// 3-state theme toggle (System, Dark, Light) with full keyboard accessibility,
// ARIA attributes, and localStorage persistence.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'preact/hooks';

export type ThemeMode = 'system' | 'dark' | 'light';

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('system');

  useEffect(() => {
    const saved = localStorage.getItem('rx-theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme('system');
    }
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      localStorage.removeItem('rx-theme');
    } else {
      root.setAttribute('data-theme', mode);
      localStorage.setItem('rx-theme', mode);
    }
  };

  const cycleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    setTheme(next);
    applyTheme(next);
  }, [theme]);

  const label =
    theme === 'system'
      ? 'Theme: System preference'
      : theme === 'dark'
        ? 'Theme: Dark mode'
        : 'Theme: Light mode';

  return (
    <button
      type="button"
      onClick={cycleTheme}
      class="rx-theme-toggle"
      aria-label={label}
      title={label}
    >
      <span class="rx-theme-icon" aria-hidden="true">
        {theme === 'system' && '◐'}
        {theme === 'dark' && '☾'}
        {theme === 'light' && '☼'}
      </span>
      <span class="rx-theme-text">{theme}</span>
    </button>
  );
}

export default ThemeToggle;
