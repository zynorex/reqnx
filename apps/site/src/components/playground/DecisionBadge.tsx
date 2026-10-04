// ──────────────────────────────────────────────────────────────────────────────
// DecisionBadge — Preact component for allowed/denied pill
// ──────────────────────────────────────────────────────────────────────────────

interface DecisionBadgeProps {
  allowed: boolean;
}

export default function DecisionBadge({ allowed }: DecisionBadgeProps) {
  return (
    <span class={`rx-badge ${allowed ? 'rx-badge-allowed' : 'rx-badge-denied'}`}>
      {allowed ? '✓ allowed' : '✗ denied'}
    </span>
  );
}
