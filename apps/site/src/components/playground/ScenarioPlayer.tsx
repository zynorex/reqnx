// ──────────────────────────────────────────────────────────────────────────────
// ScenarioPlayer — Main interactive demo (Preact island)
//
// Runs the REAL @reqnx/core library in the browser via a simulated clock.
// Users can send requests manually, run presets, or adjust config.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'preact/hooks';
import { createScenarioEngine } from '../../engine/scenario';
import { presets, presetMeta } from '../../engine/presets';
import type { PresetId } from '../../engine/presets';
import type { ScenarioStep } from '../../engine/types';
import type { AlgorithmId } from '@reqnx/core';
import ConfigPanel from './ConfigPanel';
import RequestTimeline from './RequestTimeline';
import GaugeBar from './GaugeBar';
import '../../styles/playground.css';

interface ScenarioPlayerProps {
  /** Algorithm to use. */
  algorithmId: AlgorithmId;
  /** Default limit. */
  defaultLimit?: number;
  /** Default window string. */
  defaultWindow?: string;
  /** Show config panel? */
  showConfig?: boolean;
  /** Which presets to show (filter by prefix). */
  presetFilter?: string;
}

export default function ScenarioPlayer({
  algorithmId,
  defaultLimit = 5,
  defaultWindow = '10s',
  showConfig = true,
  presetFilter,
}: ScenarioPlayerProps) {
  const [limit, setLimit] = useState(defaultLimit);
  const [window, setWindow] = useState(defaultWindow);
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [latestIndex, setLatestIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const engineRef = useRef<ReturnType<typeof createScenarioEngine> | null>(null);

  // Get current config
  const getConfig = useCallback(
    () => ({
      limit,
      window,
    }),
    [limit, window],
  );

  // Send a single manual request
  const sendRequest = useCallback(async () => {
    const engine = createScenarioEngine({
      algorithmId,
      algorithmConfig: getConfig(),
      actions: [
        ...steps.map((s) => ({
          delayMs: s.action.delayMs,
          key: s.action.key,
          cost: s.action.cost,
        })),
        { delayMs: steps.length === 0 ? 0 : 500, key: 'user-1' },
      ],
    });

    // Replay all previous steps
    const result = await engine.runAll();
    const allSteps = [...result.steps];
    const lastStep = allSteps[allSteps.length - 1];

    setSteps(allSteps);
    setLatestIndex(lastStep ? lastStep.index : -1);
    setCurrentMs(result.totalMs);
  }, [algorithmId, getConfig, steps]);

  // Run a preset scenario
  const runPreset = useCallback(async (presetId: PresetId) => {
    setIsRunning(true);
    setSteps([]);
    setLatestIndex(-1);
    setCurrentMs(0);

    const preset = presets[presetId];
    const engine = createScenarioEngine(preset);

    // Step through with animation delay
    const animatedSteps: ScenarioStep[] = [];

    for (let i = 0; i < preset.actions.length; i++) {
      const step = await engine.step();
      if (!step) break;

      animatedSteps.push(step);
      setSteps([...animatedSteps]);
      setLatestIndex(step.index);
      setCurrentMs(engine.currentMs);

      // Small delay for animation
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    setIsRunning(false);
  }, []);

  // Reset
  const reset = useCallback(() => {
    setSteps([]);
    setLatestIndex(-1);
    setCurrentMs(0);
    engineRef.current = null;
  }, []);

  // Filter presets
  const availablePresets = Object.entries(presetMeta).filter(
    ([id]) => !presetFilter || id.startsWith(presetFilter),
  ) as [PresetId, { name: string; description: string }][];

  // Summary
  const allowed = steps.filter((s) => s.decision.allowed).length;
  const denied = steps.filter((s) => !s.decision.allowed).length;
  const lastStep = steps[steps.length - 1];
  const remaining = lastStep ? lastStep.decision.remaining : limit;
  const currentLimit = lastStep ? lastStep.decision.limit : limit;

  return (
    <div class="rx-playground">
      {/* Config Panel */}
      {showConfig && (
        <div class="rx-card">
          <ConfigPanel
            limit={limit}
            window={window}
            onLimitChange={setLimit}
            onWindowChange={setWindow}
          />
        </div>
      )}

      {/* Controls */}
      <div class="rx-controls">
        <button
          type="button"
          class="rx-btn rx-btn-primary"
          onClick={sendRequest}
          disabled={isRunning}
        >
          Send Request
        </button>
        <button type="button" class="rx-btn rx-btn-outline" onClick={reset} disabled={isRunning}>
          Reset
        </button>

        {/* Preset buttons */}
        {availablePresets.map(([id, meta]) => (
          <button
            key={id}
            type="button"
            class="rx-btn rx-btn-outline"
            onClick={() => runPreset(id)}
            disabled={isRunning}
            title={meta.description}
          >
            ▶ {meta.name}
          </button>
        ))}

        <span class="rx-controls-info">t = {formatMs(currentMs)}</span>
      </div>

      {/* Capacity Gauge */}
      <div class="rx-card" style={{ padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span
            style={{
              fontFamily: 'var(--rx-font-mono)',
              fontSize: '0.75rem',
              color: 'var(--rx-text-muted)',
            }}
          >
            Remaining capacity
          </span>
          <span
            style={{
              fontFamily: 'var(--rx-font-mono)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--rx-text-primary)',
            }}
          >
            {remaining} / {currentLimit}
          </span>
        </div>
        <GaugeBar remaining={remaining} limit={currentLimit} />
      </div>

      {/* Timeline */}
      <div class="rx-card" style={{ padding: '0.75rem' }}>
        <RequestTimeline steps={steps} latestIndex={latestIndex} />
      </div>

      {/* Summary */}
      {steps.length > 0 && (
        <div class="rx-card" style={{ padding: '1rem 1.5rem' }}>
          <div class="rx-summary">
            <div class="rx-summary-stat">
              <span class="rx-summary-value" style={{ color: 'var(--rx-allowed)' }}>
                {allowed}
              </span>
              <span class="rx-summary-label">Allowed</span>
            </div>
            <div class="rx-summary-stat">
              <span class="rx-summary-value" style={{ color: 'var(--rx-denied)' }}>
                {denied}
              </span>
              <span class="rx-summary-label">Denied</span>
            </div>
            <div class="rx-summary-stat">
              <span class="rx-summary-value">{steps.length}</span>
              <span class="rx-summary-label">Total</span>
            </div>
          </div>
        </div>
      )}

      {/* Simulated label */}
      <div class="rx-simulated-label">
        ⏱ Simulated — uses a fake clock, not real time. Runs the real @reqnx/core library.
      </div>
    </div>
  );
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
