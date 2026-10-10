import { describe, expect, it } from 'vitest';
import { rollNumber } from '../src/motion/odometer.js';
import { setMotionPreference } from '../src/motion/kill-switch.js';

describe('Accessible Odometer Roller (rollNumber)', () => {
  it('renders aria-hidden visual column and screen-reader accessible final value', () => {
    setMotionPreference('system');
    document.documentElement.dataset.motion = 'full';

    const container = document.createElement('div');
    rollNumber(container, 257);

    // Screen reader accessible final text
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).not.toBeNull();
    expect(srSpan?.textContent).toBe('257');

    // Visual animated container is aria-hidden
    const visualContainer = container.querySelector('.rx-odometer-visual');
    expect(visualContainer).not.toBeNull();
    expect(visualContainer?.getAttribute('aria-hidden')).toBe('true');

    // Has 3 digit columns
    const cols = visualContainer?.querySelectorAll('.rx-odometer-col');
    expect(cols?.length).toBe(3);
  });

  it('renders final static text immediately under reduced motion', () => {
    setMotionPreference('reduced');
    document.documentElement.dataset.motion = 'reduced';

    const container = document.createElement('div');
    rollNumber(container, '100%');

    expect(container.textContent).toBe('100%');
    expect(container.querySelector('.rx-odometer-col')).toBeNull();

    // Reset preference
    setMotionPreference('system');
  });
});
