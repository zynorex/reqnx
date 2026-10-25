// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/components/chrome/ThemeControl.tsx
//
// 3-state theme control (System, Dark, Light) using the button system's
// SegmentedControl design: 16px laptop, sun, and moon icons, 28px items inside
// a 32px hairline pill. Radiogroup semantics with arrow navigation, sliding thumb,
// live OS change listener on System, and synced across all instances via CustomEvent.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'preact/hooks';
import { isMotionReduced } from '../../motion/kill-switch.js';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeControlProps {
  idPrefix?: string;
  className?: string;
}

export function ThemeControl({ idPrefix = 'rx-theme', className = '' }: ThemeControlProps) {
  const [theme, setTheme] = useState<ThemeMode>('system');

  const updateMetaThemeColor = (isDark: boolean) => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = isDark ? '#0f1117' : '#ffffff';
  };

  const applyTheme = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    let isDark = false;

    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      isDark = prefersDark;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      localStorage.removeItem('rx-theme');
    } else {
      isDark = mode === 'dark';
      root.setAttribute('data-theme', mode);
      localStorage.setItem('rx-theme', mode);
    }

    updateMetaThemeColor(isDark);
  }, []);

  useEffect(() => {
    // Read initial theme
    const stored = localStorage.getItem('rx-theme') as ThemeMode | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      setTheme(stored);
      applyTheme(stored);
    } else {
      setTheme('system');
      applyTheme('system');
    }

    // Synchronize across multiple theme toggles (Header vs Footer)
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail && customEvent.detail !== theme) {
        setTheme(customEvent.detail);
      }
    };
    window.addEventListener('rx-theme-sync', handleThemeChange);

    // Live OS listener when in System mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleOsChange = () => {
      const currentStored = localStorage.getItem('rx-theme');
      if (!currentStored || currentStored === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleOsChange);

    return () => {
      window.removeEventListener('rx-theme-sync', handleThemeChange);
      mediaQuery.removeEventListener('change', handleOsChange);
    };
  }, [applyTheme, theme]);

  const selectMode = (newMode: ThemeMode) => {
    setTheme(newMode);

    if (
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      !isMotionReduced()
    ) {
      (document as any).startViewTransition(() => {
        applyTheme(newMode);
      });
    } else {
      applyTheme(newMode);
    }

    // Broadcast change to other theme controls
    window.dispatchEvent(new CustomEvent('rx-theme-sync', { detail: newMode }));
  };

  // Keyboard arrow navigation
  const handleKeyDown = (e: KeyboardEvent, current: ThemeMode) => {
    const modes: ThemeMode[] = ['system', 'dark', 'light'];
    const currentIndex = modes.indexOf(current);
    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % modes.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + modes.length) % modes.length;
    }

    if (nextIndex !== currentIndex) {
      const nextMode = modes[nextIndex];
      selectMode(nextMode);
      const nextInput = document.getElementById(`${idPrefix}-${nextMode}`) as HTMLInputElement | null;
      nextInput?.focus();
    }
  };

  const thumbOffset = theme === 'system' ? '0px' : theme === 'dark' ? '28px' : '56px';

  return (
    <div
      class={`rx-theme-segmented-control ${className}`}
      role="radiogroup"
      aria-label="Theme"
    >
      <div
        class="rx-theme-segmented-thumb"
        style={{ transform: `translateX(${thumbOffset})` }}
        aria-hidden="true"
      />

      {/* Option 1: System */}
      <span style={{ display: 'contents' }}>
        <input
          type="radio"
          id={`${idPrefix}-system`}
          name={`${idPrefix}-radio`}
          value="system"
          checked={theme === 'system'}
          class="rx-sr-only"
          onChange={() => selectMode('system')}
          onKeyDown={(e) => handleKeyDown(e, 'system')}
        />
        <label
          htmlFor={`${idPrefix}-system`}
          class={`rx-theme-option ${theme === 'system' ? 'is-selected' : ''}`}
          title="System preference"
          aria-label="System preference"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </label>
      </span>

      {/* Option 2: Dark */}
      <span style={{ display: 'contents' }}>
        <input
          type="radio"
          id={`${idPrefix}-dark`}
          name={`${idPrefix}-radio`}
          value="dark"
          checked={theme === 'dark'}
          class="rx-sr-only"
          onChange={() => selectMode('dark')}
          onKeyDown={(e) => handleKeyDown(e, 'dark')}
        />
        <label
          htmlFor={`${idPrefix}-dark`}
          class={`rx-theme-option ${theme === 'dark' ? 'is-selected' : ''}`}
          title="Dark mode"
          aria-label="Dark mode"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </label>
      </span>

      {/* Option 3: Light */}
      <span style={{ display: 'contents' }}>
        <input
          type="radio"
          id={`${idPrefix}-light`}
          name={`${idPrefix}-radio`}
          value="light"
          checked={theme === 'light'}
          class="rx-sr-only"
          onChange={() => selectMode('light')}
          onKeyDown={(e) => handleKeyDown(e, 'light')}
        />
        <label
          htmlFor={`${idPrefix}-light`}
          class={`rx-theme-option ${theme === 'light' ? 'is-selected' : ''}`}
          title="Light mode"
          aria-label="Light mode"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </label>
      </span>
    </div>
  );
}

export default ThemeControl;
