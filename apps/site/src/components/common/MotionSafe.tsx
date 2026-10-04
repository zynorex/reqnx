// ──────────────────────────────────────────────────────────────────────────────
// MotionSafe — Preact wrapper for prefers-reduced-motion
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface MotionSafeProps {
  children: ComponentChildren;
  /** Content to show when reduced motion is preferred. Falls back to children if not set. */
  fallback?: ComponentChildren;
}

/**
 * Renders children only when the user has NOT requested reduced motion.
 * If reduced motion is active, renders the fallback (or nothing).
 */
export default function MotionSafe({ children, fallback }: MotionSafeProps) {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mql.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  if (prefersReduced) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
