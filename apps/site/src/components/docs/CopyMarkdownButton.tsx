import { useState } from 'preact/hooks';

interface Props {
  className?: string;
}

export default function CopyMarkdownButton({ className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Find the main article markdown container
      const article = document.querySelector('.sl-markdown-content') || document.querySelector('article');
      if (!article) return;

      const title = document.querySelector('h1')?.textContent?.trim() || document.title;
      const text = article.textContent || '';
      
      const payload = `# ${title}\n\nSource: ${window.location.href}\n\n${text.trim()}`;

      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  return (
    <div class={`rx-copy-md-container ${className}`}>
      <button
        type="button"
        class={`rx-copy-md-btn ${copied ? 'rx-copy-md-btn--copied' : ''}`}
        onClick={handleCopy}
        aria-label="Copy page as Markdown"
        title="Copy page as Markdown"
      >
        <svg
          class="rx-copy-md-icon"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {copied ? (
            <polyline points="20 6 9 17 4 12"></polyline>
          ) : (
            <>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </>
          )}
        </svg>
        <span>{copied ? 'Copied Markdown!' : 'Copy Markdown'}</span>
      </button>

      {copied && (
        <div class="rx-copy-toast" role="status" aria-live="polite">
          Markdown copied to clipboard
        </div>
      )}
    </div>
  );
}
