// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/components/common/ThemeToggle.tsx
//
// Professional High-Craft Theme Dropdown ("The Instrument" Architecture)
//
// Design Philosophy:
//   - Palette: Obsidian Carbon + Solar Amber & Champagne Gold (ditching generic AI indigo/cyan)
//   - Tactile Micro-Interactions: Specular hairline borders, frosted optical glass
//   - Ergonomics: Keyboard navigation, hotkeys (S, D, L), ARIA Listbox compliant
//   - High-contrast precision icons on 20px grid
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { isMotionReduced } from '../../motion/kill-switch.js';

export type ThemeMode = 'system' | 'dark' | 'light';

interface ModeOption {
  mode: ThemeMode;
  label: string;
  tagline: string;
  hotkey: string;
}

const THEME_OPTIONS: ModeOption[] = [
  {
    mode: 'system',
    label: 'System Sync',
    tagline: 'Matches device preference',
    hotkey: 'S',
  },
  {
    mode: 'dark',
    label: 'Dark Obsidian',
    tagline: 'Deep graphite canvas',
    hotkey: 'D',
  },
  {
    mode: 'light',
    label: 'Light Paper',
    tagline: 'Crisp architectural white',
    hotkey: 'L',
  },
];

/* ── Custom Precision Icons (Engineering Grade) ───────────────────────────── */

function SystemIcon({ size = 16, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2.5" />
      <line x1="8" y1="21" x2="16" y2="21" stroke-width="2" />
      <line x1="12" y1="17" x2="12" y2="21" stroke-width="2" />
      {/* Precision Display Pip */}
      <circle cx="12" cy="10" r="1.5" fill={active ? 'currentColor' : 'none'} stroke="none" />
    </svg>
  );
}

function MoonIcon({ size = 16, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      {/* Starlight Accent Pip */}
      <circle cx="17.5" cy="6.5" r="1" fill={active ? 'currentColor' : 'none'} stroke="none" />
    </svg>
  );
}

function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="1.5" x2="12" y2="3.5" />
      <line x1="12" y1="20.5" x2="12" y2="22.5" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1.5" y1="12" x2="3.5" y2="12" />
      <line x1="20.5" y1="12" x2="22.5" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function ChevronIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="rx-theme-trigger__chevron"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | undefined>(undefined);
  const graceTimerRef = useRef<number | undefined>(undefined);

  // Sync theme with document & localStorage
  const applyTheme = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      localStorage.removeItem('rx-theme');
    } else {
      root.setAttribute('data-theme', mode);
      localStorage.setItem('rx-theme', mode);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('rx-theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme('system');
    }
  }, [applyTheme]);

  // Mode Selection with optional View Transition
  const selectTheme = useCallback(
    (newMode: ThemeMode) => {
      setTheme(newMode);
      setIsOpen(false);
      setFocusedIndex(-1);

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

      window.dispatchEvent(new CustomEvent('rx-theme-sync', { detail: newMode }));
      triggerRef.current?.focus();
    },
    [applyTheme],
  );

  // Multi-instance sync (Header ↔ Footer ↔ Mobile)
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent<ThemeMode>).detail;
      if (detail && (detail === 'system' || detail === 'dark' || detail === 'light')) {
        setTheme(detail);
      }
    };
    window.addEventListener('rx-theme-sync', handleSync);
    return () => window.removeEventListener('rx-theme-sync', handleSync);
  }, []);

  // System OS theme change listener
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const stored = localStorage.getItem('rx-theme');
      if (!stored || stored === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [applyTheme]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setFocusedIndex(-1);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Hover intent: subtle 90ms entry delay, 180ms leave grace period
  const handleMouseEnter = () => {
    clearTimeout(graceTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => setIsOpen(true), 90);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimerRef.current);
    graceTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setFocusedIndex(-1);
    }, 180);
  };

  // Keyboard navigation & Hotkeys (S = System, D = Dark, L = Light)
  const handleTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(THEME_OPTIONS.findIndex((m) => m.mode === theme));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(THEME_OPTIONS.length - 1);
    }
  };

  const handlePanelKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % THEME_OPTIONS.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0) {
        selectTheme(THEME_OPTIONS[focusedIndex].mode);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setFocusedIndex(-1);
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      selectTheme('system');
    } else if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      selectTheme('dark');
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      selectTheme('light');
    }
  };

  // Focus synchronization
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const options = panelRef.current?.querySelectorAll<HTMLButtonElement>(
      '.rx-theme-dd__option',
    );
    options?.[focusedIndex]?.focus();
  }, [isOpen, focusedIndex]);

  // Current active trigger icon
  const renderActiveIcon = () => {
    switch (theme) {
      case 'system':
        return <SystemIcon size={14} active={true} />;
      case 'dark':
        return <MoonIcon size={14} active={true} />;
      case 'light':
        return <SunIcon size={14} />;
    }
  };

  const triggerLabel =
    theme === 'system'
      ? 'Theme: System sync'
      : theme === 'dark'
        ? 'Theme: Dark obsidian'
        : 'Theme: Light paper';

  return (
    <div
      class="rx-theme-dd"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Precision Trigger Capsule */}
      <button
        type="button"
        ref={triggerRef}
        class={`rx-theme-trigger ${isOpen ? 'is-active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) {
            setFocusedIndex(THEME_OPTIONS.findIndex((m) => m.mode === theme));
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span class="rx-theme-trigger__icon" aria-hidden="true">
          {renderActiveIcon()}
        </span>
        <span class="rx-theme-trigger__label">{theme}</span>
        <span class="rx-theme-trigger__pip" aria-hidden="true" />
        <ChevronIcon size={10} />
      </button>

      {/* Optical Floating Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          class="rx-theme-panel"
          role="listbox"
          aria-label="Theme mode selection"
          aria-activedescendant={
            focusedIndex >= 0 ? `rx-theme-opt-${THEME_OPTIONS[focusedIndex].mode}` : undefined
          }
          onKeyDown={handlePanelKeyDown}
        >
          {/* Header Row */}
          <div class="rx-theme-panel__header">
            <span class="rx-theme-panel__title">Appearance</span>
            <span class="rx-theme-panel__badge">Solar Amber</span>
          </div>

          {/* Options List */}
          <div class="rx-theme-panel__list">
            {THEME_OPTIONS.map((item, index) => {
              const isSelected = theme === item.mode;
              const isFocused = focusedIndex === index;

              return (
                <button
                  key={item.mode}
                  type="button"
                  id={`rx-theme-opt-${item.mode}`}
                  class={`rx-theme-dd__option ${isSelected ? 'is-selected' : ''} ${
                    isFocused ? 'is-focused' : ''
                  }`}
                  role="option"
                  aria-selected={isSelected ? 'true' : 'false'}
                  tabIndex={isFocused ? 0 : -1}
                  onClick={() => selectTheme(item.mode)}
                >
                  {/* Icon Badge */}
                  <span class={`rx-theme-dd__option-icon-box ${isSelected ? 'is-active' : ''}`}>
                    {item.mode === 'system' && <SystemIcon size={15} active={isSelected} />}
                    {item.mode === 'dark' && <MoonIcon size={15} active={isSelected} />}
                    {item.mode === 'light' && <SunIcon size={15} />}
                  </span>

                  {/* Text Details */}
                  <span class="rx-theme-dd__option-info">
                    <span class="rx-theme-dd__option-name">{item.label}</span>
                    <span class="rx-theme-dd__option-tagline">{item.tagline}</span>
                  </span>

                  {/* Hotkey Tag or Checkmark */}
                  <span class="rx-theme-dd__option-meta">
                    {isSelected ? (
                      <span class="rx-theme-dd__check" aria-hidden="true">
                        <CheckIcon size={13} />
                      </span>
                    ) : (
                      <kbd class="rx-theme-dd__kbd">{item.hotkey}</kbd>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Subtle Precision Footer */}
          <div class="rx-theme-panel__footer">
            <span class="rx-theme-panel__hint">Press S, D, or L to switch</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThemeToggle;
