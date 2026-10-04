// ──────────────────────────────────────────────────────────────────────────────
// GaugeBar — Preact component for remaining capacity visualisation
// ──────────────────────────────────────────────────────────────────────────────

interface GaugeBarProps {
  /** Current remaining capacity. */
  remaining: number;
  /** Maximum capacity (the limit). */
  limit: number;
}

export default function GaugeBar({ remaining, limit }: GaugeBarProps) {
  const pct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;

  let level: string;
  if (pct > 50) {
    level = 'rx-gauge-fill--ok';
  } else if (pct > 20) {
    level = 'rx-gauge-fill--warn';
  } else {
    level = 'rx-gauge-fill--critical';
  }

  return (
    <div
      class="rx-gauge"
      role="progressbar"
      aria-valuenow={remaining}
      aria-valuemin={0}
      aria-valuemax={limit}
    >
      <div class={`rx-gauge-fill ${level}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
