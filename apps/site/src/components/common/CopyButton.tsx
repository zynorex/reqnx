// ──────────────────────────────────────────────────────────────────────────────
// CopyButton — Preact island for clipboard copy
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'preact/hooks';
import { isMotionReduced } from '../../motion/kill-switch.js';

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      const cmdBox = buttonRef.current?.closest('.rx-cmd-box');
      if (cmdBox) {
        cmdBox.classList.add('is-copied');
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        if (cmdBox) {
          cmdBox.classList.remove('is-copied');
        }
      }, 1600);
    } catch {
      // Fallback: clipboard API not permitted
    }
  }, [text]);

  const reduced = typeof window !== 'undefined' && isMotionReduced();

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleCopy}
      class={`rx-copy-btn ${copied ? 'is-copied' : ''}`}
      aria-label={copied ? 'Copied to clipboard' : 'Copy command to clipboard'}
      title={copied ? 'Copied to clipboard' : 'Copy command to clipboard'}
    >
      <span class="sr-only" role="status" aria-live="polite">
        {copied ? 'Command copied to clipboard' : ''}
      </span>
      <span class="rx-copy-btn__icon" aria-hidden="true">
        {copied ? (
          <svg
            class={`rx-copy-check ${reduced ? 'is-reduced' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            class="rx-copy-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </span>
      <span class="rx-copy-btn__label">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

