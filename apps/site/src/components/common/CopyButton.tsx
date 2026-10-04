// ──────────────────────────────────────────────────────────────────────────────
// CopyButton — Preact island for clipboard copy
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'preact/hooks';

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing, clipboard API not available
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      title={copied ? 'Copied' : 'Copy to clipboard'}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '0.25rem',
        marginLeft: '0.75rem',
        color: copied ? 'var(--rx-allowed)' : 'var(--rx-text-muted)',
        fontSize: '0.85rem',
        transition: 'color var(--rx-transition-fast)',
        verticalAlign: 'middle',
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}
