// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/motion/mobile.ts
//
// Flagship Mobile Runtime:
// 1. Passive touch pressed state tracking (< 90ms budget)
// 2. visualViewport keyboard detection (body.has-keyboard)
// 3. Hardware Back button / popstate sheet history manager
// 4. Lite mode detection (Save-Data, low-end hardware)
// 5. Progressive enhancement Vibration API haptics
// ──────────────────────────────────────────────────────────────────────────────

let isInitialized = false;
let currentPressedEl: HTMLElement | null = null;
let pressedClearTimer: number | null = null;

/**
 * Trigger immediate tactile pressed state on interactive elements
 */
function handlePointerDown(e: PointerEvent): void {
  // Only handle primary pointer (left mouse or first finger)
  if (!e.isPrimary) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  const interactive = target.closest<HTMLElement>(
    'button, .btn, a, [data-pressable], [role="button"], [role="tab"], .rx-dock-item'
  );
  if (!interactive || interactive.hasAttribute('disabled') || interactive.getAttribute('aria-disabled') === 'true') {
    return;
  }

  // Clear previous if any
  clearPressed();

  currentPressedEl = interactive;
  interactive.setAttribute('data-pressed', 'true');

  // Fallback cleanup timer in case scroll cancellation swallows pointerup/cancel
  pressedClearTimer = window.setTimeout(clearPressed, 500);
}

function clearPressed(): void {
  if (pressedClearTimer !== null) {
    clearTimeout(pressedClearTimer);
    pressedClearTimer = null;
  }
  if (currentPressedEl) {
    currentPressedEl.removeAttribute('data-pressed');
    currentPressedEl = null;
  }
}

/**
 * Handle virtual keyboard appearance on mobile devices
 */
function setupVisualViewport(): void {
  if (typeof window === 'undefined' || !window.visualViewport) return;

  const vv = window.visualViewport;
  const updateKeyboardState = () => {
    // A shrinkage > 120px typically indicates mobile software keyboard opened
    const isKeyboardOpen = window.innerHeight - vv.height > 120;
    if (isKeyboardOpen) {
      document.body.classList.add('has-keyboard');
    } else {
      document.body.classList.remove('has-keyboard');
    }
  };

  vv.addEventListener('resize', updateKeyboardState, { passive: true });
}

/**
 * Sheet History Manager: allows Android hardware back button / back gesture
 * to dismiss open modal sheets instead of navigating away.
 */
interface SheetHistoryEntry {
  sheetId: string;
  onClose: () => void;
}

const activeSheetStack: SheetHistoryEntry[] = [];
let isPopstateHandling = false;

function setupSheetHistory(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('popstate', (e) => {
    if (activeSheetStack.length === 0) return;

    isPopstateHandling = true;
    const top = activeSheetStack.pop();
    if (top) {
      top.onClose();
    }
    isPopstateHandling = false;
  });
}

export function pushSheetHistory(sheetId: string, onClose: () => void): void {
  if (typeof window === 'undefined') return;

  // Push state to browser history
  window.history.pushState({ rxSheet: sheetId }, '');
  activeSheetStack.push({ sheetId, onClose });
}

export function popSheetHistory(sheetId: string): void {
  if (typeof window === 'undefined') return;
  if (isPopstateHandling) return;

  const index = activeSheetStack.findIndex((entry) => entry.sheetId === sheetId);
  if (index !== -1) {
    activeSheetStack.splice(index, 1);
    // If the top state in history is ours, back out of it
    if (window.history.state && window.history.state.rxSheet === sheetId) {
      window.history.back();
    }
  }
}

/**
 * Progressive Enhancement Haptics
 * Default-off, explicitly toggled in preferences or dev workbench.
 */
export type HapticStyle = 'tap' | 'success' | 'warning' | 'error';

export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('rx-haptics') === 'on';
  } catch {
    return false;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('rx-haptics', enabled ? 'on' : 'off');
  } catch {}
}

export function triggerHaptic(style: HapticStyle = 'tap'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  if (!isHapticsEnabled()) return;

  try {
    switch (style) {
      case 'tap':
        navigator.vibrate(10); // Crisp 10ms pulse
        break;
      case 'success':
        navigator.vibrate([12, 40, 15]); // Double pulse
        break;
      case 'warning':
        navigator.vibrate([20, 40, 20]);
        break;
      case 'error':
        navigator.vibrate([30, 50, 40]);
        break;
    }
  } catch {
    // Vibration API may throw or fail silently on unsupported platforms
  }
}

/**
 * Initialize Mobile Runtime
 */
export function initMobileRuntime(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // 1. Tactile Pressed tracking
  document.addEventListener('pointerdown', handlePointerDown, { passive: true });
  document.addEventListener('pointerup', clearPressed, { passive: true });
  document.addEventListener('pointercancel', clearPressed, { passive: true });
  document.addEventListener('pointerleave', clearPressed, { passive: true });

  // 2. Keyboard viewport detection
  setupVisualViewport();

  // 3. Sheet back button history
  setupSheetHistory();
}

// Auto-initialize when loaded in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileRuntime);
  } else {
    initMobileRuntime();
  }
}
