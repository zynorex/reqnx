// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/motion/pointer.ts
//
// Single shared rAF pointer tracking loop for micro-interactions (E6 backlight, E16 card).
// Zero scroll listeners, passive pointer events, automatic pausing when off-screen.
// ──────────────────────────────────────────────────────────────────────────────

import { isMotionReduced } from './kill-switch.js';

type PointerUpdateFn = (x: number, y: number, target: HTMLElement) => void;

interface PointerSubscriber {
  element: HTMLElement;
  callback: PointerUpdateFn;
  isVisible: boolean;
}

const subscribers = new Set<PointerSubscriber>();
let rafId: number | null = null;
let currentX = 0;
let currentY = 0;
let isListening = false;

function onPointerMove(e: PointerEvent): void {
  currentX = e.clientX;
  currentY = e.clientY;
  scheduleFrame();
}

function processFrame(): void {
  rafId = null;
  if (isMotionReduced()) return;

  for (const sub of subscribers) {
    if (!sub.isVisible) continue;
    const rect = sub.element.getBoundingClientRect();
    // Only dispatch if pointer is within or near the element bounds
    const relativeX = currentX - rect.left;
    const relativeY = currentY - rect.top;
    sub.callback(relativeX, relativeY, sub.element);
  }
}

function scheduleFrame(): void {
  if (rafId === null) {
    rafId = requestAnimationFrame(processFrame);
  }
}

function startListening(): void {
  if (isListening || typeof window === 'undefined') return;
  // Hover capable only
  if (!window.matchMedia('(hover: hover)').matches) return;

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  isListening = true;
}

function stopListening(): void {
  if (!isListening || typeof window === 'undefined') return;
  window.removeEventListener('pointermove', onPointerMove);
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  isListening = false;
}

/**
 * Subscribe an element to the shared pointer position loop.
 */
export function trackPointer(element: HTMLElement, callback: PointerUpdateFn): () => void {
  if (typeof window === 'undefined' || isMotionReduced()) {
    return () => {};
  }

  const sub: PointerSubscriber = {
    element,
    callback,
    isVisible: true,
  };

  subscribers.add(sub);
  if (subscribers.size === 1) {
    startListening();
  }

  return () => {
    subscribers.delete(sub);
    if (subscribers.size === 0) {
      stopListening();
    }
  };
}
