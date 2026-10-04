// ──────────────────────────────────────────────────────────────────────────────
// RequestTimeline — Preact component for request history visualisation
// ──────────────────────────────────────────────────────────────────────────────

import type { ScenarioStep } from '../../engine/types';
import DecisionBadge from './DecisionBadge';
import '../../styles/playground.css';

interface RequestTimelineProps {
  steps: readonly ScenarioStep[];
  /** Index of the most recently added step (for animation). */
  latestIndex: number;
}

/** Format milliseconds as a human-readable time string. */
function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

export default function RequestTimeline({ steps, latestIndex }: RequestTimelineProps) {
  if (steps.length === 0) {
    return (
      <div class="rx-timeline" style={{ padding: '2rem', textAlign: 'center' }}>
        <p
          style={{
            color: 'var(--rx-text-muted)',
            fontFamily: 'var(--rx-font-mono)',
            fontSize: '0.85rem',
          }}
        >
          No requests yet. Click &ldquo;Send Request&rdquo; or run a preset.
        </p>
      </div>
    );
  }

  return (
    <div class="rx-timeline">
      {steps.map((step) => (
        <div
          key={step.index}
          class={`rx-timeline-entry ${step.index === latestIndex ? 'rx-timeline-entry--new' : ''}`}
        >
          <span class="rx-timeline-time">{formatMs(step.atMs)}</span>
          <span class="rx-timeline-key">{step.action.key}</span>
          <span class="rx-timeline-remaining">
            {step.decision.remaining}/{step.decision.limit} remaining
          </span>
          <DecisionBadge allowed={step.decision.allowed} />
        </div>
      ))}
    </div>
  );
}
