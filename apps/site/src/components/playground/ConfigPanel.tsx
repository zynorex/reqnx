// ──────────────────────────────────────────────────────────────────────────────
// ConfigPanel — Preact component for algorithm config controls
// ──────────────────────────────────────────────────────────────────────────────

import '../../styles/playground.css';

interface ConfigPanelProps {
  limit: number;
  window: string;
  onLimitChange: (limit: number) => void;
  onWindowChange: (window: string) => void;
}

export default function ConfigPanel({
  limit,
  window: windowValue,
  onLimitChange,
  onWindowChange,
}: ConfigPanelProps) {
  return (
    <div class="rx-config-panel">
      <div class="rx-config-field">
        <label class="rx-config-label" for="config-limit">
          Limit
        </label>
        <input
          id="config-limit"
          class="rx-config-input"
          type="number"
          min={1}
          max={100}
          value={limit}
          onInput={(e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            if (!isNaN(val) && val >= 1) onLimitChange(val);
          }}
        />
      </div>
      <div class="rx-config-field">
        <label class="rx-config-label" for="config-window">
          Window
        </label>
        <select
          id="config-window"
          class="rx-config-input"
          value={windowValue}
          onChange={(e) => onWindowChange((e.target as HTMLSelectElement).value)}
        >
          <option value="1s">1 second</option>
          <option value="5s">5 seconds</option>
          <option value="10s">10 seconds</option>
          <option value="30s">30 seconds</option>
          <option value="1m">1 minute</option>
        </select>
      </div>
    </div>
  );
}
