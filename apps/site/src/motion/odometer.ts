// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/motion/odometer.ts
//
// Accessible digit column roller for metrics and console readouts (E10, E15).
// Features:
// - Animated columns are aria-hidden="true"
// - Visually hidden screen-reader span holds exact static final value
// - Tabular numerals & reserved widths prevent layout shift (CLS = 0)
// - Reduced motion displays final value immediately without animation
// ──────────────────────────────────────────────────────────────────────────────

import { isMotionReduced } from './kill-switch.js';

export interface OdometerOptions {
  durationMs?: number;
  digitStaggerMs?: number;
}

/**
 * Animate a numeric element using rolling digit columns.
 */
export function rollNumber(
  container: HTMLElement,
  targetValue: number | string,
  options: OdometerOptions = {},
): void {
  const finalStr = String(targetValue);
  const duration = options.durationMs ?? 220;
  const stagger = options.digitStaggerMs ?? 30;

  // Immediate exit for reduced motion or SSR
  if (isMotionReduced()) {
    container.textContent = finalStr;
    return;
  }

  // Preserve existing content as screen-reader fallback
  container.innerHTML = '';

  const srSpan = document.createElement('span');
  srSpan.className = 'sr-only';
  srSpan.textContent = finalStr;
  container.appendChild(srSpan);

  const visualContainer = document.createElement('span');
  visualContainer.setAttribute('aria-hidden', 'true');
  visualContainer.className = 'rx-odometer-visual';
  visualContainer.style.display = 'inline-flex';
  visualContainer.style.overflow = 'hidden';
  visualContainer.style.verticalAlign = 'baseline';

  const chars = finalStr.split('');

  chars.forEach((char, idx) => {
    const isDigit = /^[0-9]$/.test(char);
    if (!isDigit) {
      const charSpan = document.createElement('span');
      charSpan.textContent = char;
      charSpan.style.display = 'inline-block';
      visualContainer.appendChild(charSpan);
      return;
    }

    const digit = parseInt(char, 10);
    const col = document.createElement('span');
    col.className = 'rx-odometer-col';
    col.style.display = 'inline-flex';
    col.style.flexDirection = 'column';
    col.style.lineHeight = '1';
    col.style.transition = `transform ${duration}ms var(--rx-ease-out, cubic-bezier(0.2, 0, 0, 1))`;
    col.style.transitionDelay = `${idx * stagger}ms`;

    // Render digits 0 through 9
    for (let d = 0; d <= 9; d++) {
      const digitSpan = document.createElement('span');
      digitSpan.textContent = String(d);
      digitSpan.style.display = 'block';
      digitSpan.style.height = '1em';
      digitSpan.style.textAlign = 'center';
      col.appendChild(digitSpan);
    }

    // Set initial offset at 0
    col.style.transform = `translateY(0%)`;
    visualContainer.appendChild(col);

    // Schedule transition to target digit
    requestAnimationFrame(() => {
      col.style.transform = `translateY(-${digit * 10}%)`;
    });
  });

  container.appendChild(visualContainer);
}
