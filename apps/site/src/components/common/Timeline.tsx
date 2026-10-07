// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Shared Request Timeline Component (Preact)
//
// Shared geometry and time-scale logic used by both LiveConsole (Hero)
// and Playground. Supports SVG horizontal time-axis projection.
// ──────────────────────────────────────────────────────────────────────────────

import type { ScenarioStep } from '../../engine/types.js';

export interface TimelineProps {
  variant?: 'hero' | 'playground';
  currentMs: number;
  windowMs: number;
  limit: number;
  steps: readonly ScenarioStep[];
  latestStepIndex?: number;
  pulseEvent?: 'denial' | 'rollover' | null;
  className?: string;
}

export function Timeline({
  variant = 'hero',
  currentMs,
  windowMs,
  limit,
  steps,
  latestStepIndex,
  pulseEvent,
  className = '',
}: TimelineProps) {
  // SVG Canvas dimensions
  const width = 800;
  const height = variant === 'hero' ? 120 : 100;
  const axisY = variant === 'hero' ? 76 : 64;

  // "Now" cursor is fixed at 70% width for forward lookahead
  const nowX = width * 0.7;

  // Visible time window span: 2.2× windowMs
  const visibleTimeSpanMs = Math.max(windowMs * 2.2, 8000);
  const pxPerMs = (width * 0.7) / (visibleTimeSpanMs * 0.7);

  // Time to X coordinate projection
  const timeToX = (timeMs: number): number => {
    return nowX + (timeMs - currentMs) * pxPerMs;
  };

  // Compute visible time range
  const minVisibleTime = currentMs - nowX / pxPerMs;
  const maxVisibleTime = currentMs + (width - nowX) / pxPerMs;

  // Compute aligned window boundaries within visible range
  const firstWindowIndex = Math.floor(minVisibleTime / windowMs);
  const lastWindowIndex = Math.ceil(maxVisibleTime / windowMs);

  const windowBoundaries: Array<{ timeMs: number; x: number; label: string }> = [];
  for (let w = firstWindowIndex; w <= lastWindowIndex; w++) {
    const boundaryTime = w * windowMs;
    const bx = timeToX(boundaryTime);
    if (bx >= -50 && bx <= width + 50) {
      windowBoundaries.push({
        timeMs: boundaryTime,
        x: bx,
        label: `W${w + 1} (${(boundaryTime / 1000).toFixed(1)}s)`,
      });
    }
  }

  // Compute minor ticks (every 1s or windowMs/4)
  const minorTickInterval = windowMs >= 4000 ? 1000 : 500;
  const firstMinor = Math.floor(minVisibleTime / minorTickInterval);
  const lastMinor = Math.ceil(maxVisibleTime / minorTickInterval);

  const minorTicks: number[] = [];
  for (let m = firstMinor; m <= lastMinor; m++) {
    const mt = m * minorTickInterval;
    if (mt % windowMs !== 0) {
      const mx = timeToX(mt);
      if (mx >= 0 && mx <= width) {
        minorTicks.push(mx);
      }
    }
  }

  // Filter and stack visible steps
  const visibleSteps = steps.filter((step) => {
    const sx = timeToX(step.atMs);
    return sx >= -20 && sx <= width + 20;
  });

  // Vertical stacking for simultaneous or near-simultaneous requests
  const stackedSteps: Array<{
    step: ScenarioStep;
    x: number;
    stackIndex: number;
    isLatest: boolean;
  }> = [];

  for (let i = 0; i < visibleSteps.length; i++) {
    const step = visibleSteps[i];
    const sx = timeToX(step.atMs);

    // Count how many prior visible steps share nearly the same X position
    let stack = 0;
    for (let j = 0; j < i; j++) {
      if (Math.abs(visibleSteps[j].atMs - step.atMs) <= 150) {
        stack++;
      }
    }

    stackedSteps.push({
      step,
      x: sx,
      stackIndex: stack,
      isLatest: step.index === latestStepIndex,
    });
  }

  return (
    <div class={`rx-timeline-container rx-timeline--${variant} ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        class="rx-timeline-svg"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-hidden="true"
      >
        <defs>
          {/* Subtle grid pattern */}
          <linearGradient id="rx-timeline-fade-left" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="var(--rx-surface-2)" stop-opacity="1" />
            <stop offset="100%" stop-color="var(--rx-surface-2)" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="rx-timeline-fade-right" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="var(--rx-surface-2)" stop-opacity="0" />
            <stop offset="100%" stop-color="var(--rx-surface-2)" stop-opacity="1" />
          </linearGradient>
        </defs>

        {/* Background Canvas */}
        <rect width={width} height={height} fill="var(--rx-surface-2)" rx="8" />

        {/* Minor ticks */}
        {minorTicks.map((mx, idx) => (
          <line
            key={`minor-${idx}`}
            x1={mx}
            y1={axisY - 4}
            x2={mx}
            y2={axisY + 4}
            stroke="var(--rx-border-subtle)"
            stroke-width="1"
          />
        ))}

        {/* Window boundary lines and labels */}
        {windowBoundaries.map((b, idx) => (
          <g key={`bound-${idx}`} class="rx-timeline-boundary">
            <line
              x1={b.x}
              y1={16}
              x2={b.x}
              y2={height - 12}
              stroke="var(--rx-tick-major-color)"
              stroke-width="1.5"
              stroke-dasharray="3 3"
            />
            <text
              x={b.x + 4}
              y={24}
              fill="var(--rx-text-3)"
              font-family="var(--rx-font-mono)"
              font-size="11"
              font-weight="600"
            >
              {b.label}
            </text>
          </g>
        ))}

        {/* Main Time Axis Line */}
        <line
          x1={0}
          y1={axisY}
          x2={width}
          y2={axisY}
          stroke="var(--rx-border)"
          stroke-width="1.5"
        />

        {/* Render Request Step Markers */}
        {stackedSteps.map(({ step, x, stackIndex, isLatest }) => {
          const markerY = axisY - 14 - stackIndex * 15;
          const allowed = step.decision.allowed;

          return (
            <g
              key={`step-${step.index}`}
              class={`rx-timeline-marker ${allowed ? 'is-allowed' : 'is-denied'} ${
                isLatest ? 'is-latest' : ''
              }`}
            >
              {/* Vertical connector line from axis to marker */}
              <line
                x1={x}
                y1={axisY}
                x2={x}
                y2={markerY}
                stroke={allowed ? 'var(--rx-semantic-allowed)' : 'var(--rx-semantic-denied)'}
                stroke-width="1"
                stroke-opacity="0.4"
              />

              {/* Marker shape */}
              {allowed ? (
                // Allowed: Filled circle
                <circle
                  cx={x}
                  cy={markerY}
                  r="5"
                  fill="var(--rx-semantic-allowed)"
                  stroke="var(--rx-surface-1)"
                  stroke-width="1.5"
                />
              ) : (
                // Denied: Hollow diamond with cross
                <g transform={`translate(${x - 6}, ${markerY - 6})`}>
                  <polygon
                    points="6,0 12,6 6,12 0,6"
                    fill="var(--rx-semantic-denied-surface)"
                    stroke="var(--rx-semantic-denied)"
                    stroke-width="1.75"
                  />
                  <line
                    x1="3.5"
                    y1="3.5"
                    x2="8.5"
                    y2="8.5"
                    stroke="var(--rx-semantic-denied)"
                    stroke-width="1.2"
                  />
                  <line
                    x1="8.5"
                    y1="3.5"
                    x2="3.5"
                    y2="8.5"
                    stroke="var(--rx-semantic-denied)"
                    stroke-width="1.2"
                  />
                </g>
              )}

              {/* Pulse effect on latest event if denial */}
              {isLatest && !allowed && pulseEvent === 'denial' && (
                <circle
                  cx={x}
                  cy={markerY}
                  r="11"
                  fill="none"
                  stroke="var(--rx-semantic-denied)"
                  stroke-width="1.5"
                  class="rx-pulse-ring"
                />
              )}
            </g>
          );
        })}

        {/* "NOW" Indicator Cursor */}
        <g class="rx-timeline-now">
          <line
            x1={nowX}
            y1={12}
            x2={nowX}
            y2={height - 12}
            stroke="var(--rx-accent-cyan)"
            stroke-width="2"
          />
          {/* Top Badge */}
          <rect x={nowX - 22} y={6} width={44} height={16} rx={3} fill="var(--rx-accent-cyan)" />
          <text
            x={nowX}
            y={18}
            text-anchor="middle"
            fill="#090d16"
            font-family="var(--rx-font-mono)"
            font-size="9"
            font-weight="700"
            letter-spacing="0.05em"
          >
            NOW
          </text>
        </g>

        {/* Edge Fade Gradients for clean horizontal scroll appearance */}
        <rect
          x="0"
          y="0"
          width="30"
          height={height}
          fill="url(#rx-timeline-fade-left)"
          pointer-events="none"
        />
        <rect
          x={width - 30}
          y="0"
          width="30"
          height={height}
          fill="url(#rx-timeline-fade-right)"
          pointer-events="none"
        />
      </svg>
    </div>
  );
}

export default Timeline;
