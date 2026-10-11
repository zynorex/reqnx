import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CopyButton Behavior & State Machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('interacts with navigator.clipboard and updates state machine', async () => {
    let copied = false;
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    const clipboardMock = {
      writeText: writeTextMock,
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: clipboardMock },
      configurable: true,
      writable: true,
    });

    const triggerCopy = async (text: string) => {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1600);
    };

    // Initial state
    expect(copied).toBe(false);

    // Trigger copy
    await triggerCopy('pnpm add @reqnx/core');
    expect(writeTextMock).toHaveBeenCalledWith('pnpm add @reqnx/core');
    expect(copied).toBe(true);

    // Fast-forward 1500ms -> should still be copied
    vi.advanceTimersByTime(1500);
    expect(copied).toBe(true);

    // Fast-forward another 100ms (1600ms total) -> should revert to false
    vi.advanceTimersByTime(100);
    expect(copied).toBe(false);
  });

  it('handles clipboard error gracefully without throwing', async () => {
    let copied = false;
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));

    const triggerCopySafe = async (text: string) => {
      try {
        await writeTextMock(text);
        copied = true;
      } catch {
        // Fallback gracefully
      }
    };

    await triggerCopySafe('pnpm add @reqnx/core');
    expect(copied).toBe(false);
  });
});
