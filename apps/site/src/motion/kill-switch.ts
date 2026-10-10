// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/motion/kill-switch.ts
//
// Client motion kill switch manager.
// Ensures user or OS preference is enforced before first paint to prevent layout flicker.
// ──────────────────────────────────────────────────────────────────────────────

export type MotionMode = 'system' | 'reduced';

const STORAGE_KEY = 'rx-motion';

/**
 * Early execution script string suitable for embedding synchronously in <head>.
 * Runs before stylesheet parsing to set <html data-motion="...">.
 */
export const inlineMotionInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    var isSaveData = Boolean(navigator.connection && navigator.connection.saveData);
    
    // Visitor can only reduce motion, never override the OS or Save-Data to force full motion
    if (stored === 'reduced' || mql.matches || isSaveData) {
      document.documentElement.dataset.motion = 'reduced';
    } else {
      document.documentElement.dataset.motion = 'full';
    }
  } catch (e) {
    document.documentElement.dataset.motion = 'full';
  }
})();
`;

export function getStoredMotionPreference(): MotionMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === 'reduced' ? 'reduced' : 'system';
  } catch {
    return 'system';
  }
}

export function isMotionReduced(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  if (Boolean((navigator as any).connection?.saveData)) return true;
  return false;
}

export function setMotionPreference(mode: MotionMode): void {
  if (typeof window === 'undefined') return;
  try {
    if (mode === 'reduced') {
      localStorage.setItem(STORAGE_KEY, 'reduced');
      document.documentElement.dataset.motion = 'reduced';
    } else {
      localStorage.removeItem(STORAGE_KEY);
      const osReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isSaveData = Boolean((navigator as any).connection?.saveData);
      document.documentElement.dataset.motion = osReduced || isSaveData ? 'reduced' : 'full';
    }

    window.dispatchEvent(
      new CustomEvent('rx-motion-change', {
        detail: { mode, reduced: isMotionReduced() },
      }),
    );
  } catch (e) {
    console.warn('Unable to persist motion preference:', e);
  }
}
