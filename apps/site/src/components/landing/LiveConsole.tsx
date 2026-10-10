// ──────────────────────────────────────────────────────────────────────────────
// apps/site — LiveConsole (The Instrument)
//
// Interactive rate limiter console running real @reqnx/core in the browser
// with a simulated clock. Pre-renders initial state for zero-CLS static HTML.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { createLimiter, createMemoryStore, fixedWindow, tokenBucket } from '@reqnx/core';
import type { Decision } from '@reqnx/core';
import { createBrowserFakeClock } from '../../engine/fake-clock.js';
import { algorithms } from '../../features.js';
import { Timeline } from '../common/Timeline.js';
import { rollNumber } from '../../motion/odometer.js';
import type { PrecomputedHeroState } from '../../engine/hero-precompute.js';
import type { ScenarioStep } from '../../engine/types.js';

interface LiveConsoleProps {
  initialState?: PrecomputedHeroState;
}

function NumericValue({
  value,
  className = '',
}: {
  value: number | string;
  className?: string;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      rollNumber(containerRef.current, value, { durationMs: 220, digitStaggerMs: 20 });
    }
  }, [value]);

  return (
    <span ref={containerRef} class={className}>
      {value}
    </span>
  );
}

export function LiveConsole({ initialState }: LiveConsoleProps) {
  const windowMs = initialState?.windowMs ?? 4000;
  const limit = initialState?.limit ?? 5;

  // Runtime clock and limiter instance
  const clockRef = useRef(createBrowserFakeClock(initialState?.currentMs ?? 3500));
  const storeRef = useRef(createMemoryStore({ clock: clockRef.current }));
  const limiterRef = useRef(
    createLimiter({
      algorithm: fixedWindow,
      store: storeRef.current,
      prefix: 'live-console',
      config: { limit, window: `${windowMs}ms` },
    }),
  );

  // Component state
  const [selectedAlgo, setSelectedAlgo] = useState<'fixed-window' | 'token-bucket'>('fixed-window');
  const [isWiping, setIsWiping] = useState(false);
  const [nudgingTab, setNudgingTab] = useState<string | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState<{
    left: number;
    width: number;
    visible: boolean;
  }>({ left: 0, width: 0, visible: false });

  const [currentMs, setCurrentMs] = useState(initialState?.currentMs ?? 3500);
  const [steps, setSteps] = useState<ScenarioStep[]>(
    initialState?.steps ? [...initialState.steps] : [],
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [pulseEvent, setPulseEvent] = useState<'denial' | 'rollover' | null>(null);
  const [flashType, setFlashType] = useState<'allowed' | 'denied' | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const lastAnnounceTimeRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);

  // Announce helper (throttled to at most once per 2 seconds)
  const announce = useCallback((text: string) => {
    const now = Date.now();
    if (now - lastAnnounceTimeRef.current >= 2000) {
      setLiveAnnouncement(text);
      lastAnnounceTimeRef.current = now;
    }
  }, []);

  // Update tab indicator geometry
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeBtn = tabsContainerRef.current.querySelector<HTMLButtonElement>(
        `.rx-console__tab.is-active`,
      );
      if (activeBtn) {
        const containerRect = tabsContainerRef.current.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        setTabIndicatorStyle({
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
          visible: true,
        });
      }
    }
  }, [selectedAlgo]);

  // Dispatch a single request
  const sendRequest = useCallback(async () => {
    clockRef.current.advance(150);
    const atMs = clockRef.current.nowMs();
    const decision = await limiterRef.current.check('client-1');

    const newStep: ScenarioStep = {
      index: steps.length,
      action: { delayMs: 150, key: 'client-1' },
      atMs,
      decision,
    };

    setSteps((prev) => [...prev, newStep]);
    setCurrentMs(atMs);

    if (!decision.allowed) {
      setPulseEvent('denial');
      setFlashType('denied');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rx-console-denial'));
      }
      announce(
        `Request denied. Retry after ${(decision.retryAfterMs! / 1000).toFixed(1)} seconds.`,
      );
      setTimeout(() => {
        setPulseEvent(null);
        setFlashType(null);
      }, 400);
    } else {
      setFlashType('allowed');
      setTimeout(() => setFlashType(null), 260);
      announce(`Request allowed. ${decision.remaining} of ${decision.limit} remaining.`);
    }
  }, [steps.length, announce]);

  // Dispatch a burst of limit + 2 requests
  const sendBurst = useCallback(async () => {
    const burstCount = limit + 2;
    const newSteps: ScenarioStep[] = [];

    for (let i = 0; i < burstCount; i++) {
      clockRef.current.advance(80);
      const atMs = clockRef.current.nowMs();
      const decision = await limiterRef.current.check('client-1');

      newSteps.push({
        index: steps.length + i,
        action: { delayMs: 80, key: 'client-1' },
        atMs,
        decision,
      });
    }

    setSteps((prev) => [...prev, ...newSteps]);
    const lastAtMs = clockRef.current.nowMs();
    setCurrentMs(lastAtMs);
    setPulseEvent('denial');
    setFlashType('denied');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rx-console-denial'));
    }
    announce(`Burst of ${burstCount} sent. Over-limit requests denied.`);
    setTimeout(() => {
      setPulseEvent(null);
      setFlashType(null);
    }, 400);
  }, [limit, steps.length, announce]);

  // Reset engine to initial state
  const resetEngine = useCallback(() => {
    clockRef.current = createBrowserFakeClock(0);
    storeRef.current = createMemoryStore({ clock: clockRef.current });
    const currentAlgorithm = selectedAlgo === 'token-bucket' ? tokenBucket : fixedWindow;
    const currentConfig =
      selectedAlgo === 'token-bucket'
        ? ({ capacity: limit, refillRate: 1, interval: '1s' } as any)
        : { limit, window: `${windowMs}ms` };

    limiterRef.current = createLimiter({
      algorithm: currentAlgorithm,
      store: storeRef.current,
      prefix: 'live-console',
      config: currentConfig,
    });

    setCurrentMs(0);
    setSteps([]);
    setIsPlaying(false);
    announce('Console reset to t = 0s.');
  }, [limit, windowMs, selectedAlgo, announce]);

  // Algorithm switch handler (E12)
  const handleTabClick = (algoId: string, isAvailable: boolean) => {
    if (!isAvailable) {
      setNudgingTab(algoId);
      setTimeout(() => setNudgingTab(null), 220);
      return;
    }

    if (algoId === selectedAlgo) return;

    setIsWiping(true);
    const target = algoId as 'fixed-window' | 'token-bucket';
    setSelectedAlgo(target);

    clockRef.current = createBrowserFakeClock(0);
    storeRef.current = createMemoryStore({ clock: clockRef.current });
    const algoImpl = target === 'token-bucket' ? tokenBucket : fixedWindow;
    const config =
      target === 'token-bucket'
        ? ({ capacity: limit, refillRate: 1, interval: '1s' } as any)
        : { limit, window: `${windowMs}ms` };

    limiterRef.current = createLimiter({
      algorithm: algoImpl,
      store: storeRef.current,
      prefix: 'live-console',
      config,
    });

    setCurrentMs(0);
    setSteps([]);
    announce(`Switched algorithm to ${target === 'token-bucket' ? 'Token Bucket' : 'Fixed Window Counter'}.`);
    setTimeout(() => setIsWiping(false), 240);
  };

  // Visibility and intersection observation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisibleRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Automated playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(async () => {
      if (!isVisibleRef.current) return;

      clockRef.current.advance(400);
      const atMs = clockRef.current.nowMs();

      // Check for window rollover pulse
      if (Math.floor(atMs / windowMs) > Math.floor((atMs - 400) / windowMs)) {
        setPulseEvent('rollover');
        setTimeout(() => setPulseEvent(null), 400);
      }

      // Generate background traffic occasionally
      if (Math.random() > 0.35) {
        const decision = await limiterRef.current.check('client-1');
        const newStep: ScenarioStep = {
          index: steps.length,
          action: { delayMs: 400, key: 'client-1' },
          atMs,
          decision,
        };
        setSteps((prev) => [...prev, newStep]);
        if (!decision.allowed) {
          setFlashType('denied');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rx-console-denial'));
          }
          setTimeout(() => setFlashType(null), 260);
        } else {
          setFlashType('allowed');
          setTimeout(() => setFlashType(null), 260);
        }
      }

      setCurrentMs(atMs);
    }, 400);

    return () => clearInterval(interval);
  }, [isPlaying, windowMs, steps.length]);

  // Derived metrics from latest decision
  const latestStep = steps[steps.length - 1] ?? initialState?.latestStep;
  const latestDecision: Decision | undefined = latestStep?.decision;

  const allowedCount = steps.filter((s) => s.decision.allowed).length;
  const deniedCount = steps.filter((s) => !s.decision.allowed).length;
  const remaining = latestDecision ? latestDecision.remaining : limit;
  const retryAfterMs =
    latestDecision && !latestDecision.allowed ? (latestDecision.retryAfterMs ?? 0) : 0;
  const resetAtMs = latestDecision ? latestDecision.resetAtMs : windowMs;
  const resetInSec = Math.max(0, (resetAtMs - currentMs) / 1000).toFixed(1);

  // Calculate peak in any window-length span
  const peakInWindow = steps.reduce((max, s, i) => {
    const windowStart = s.atMs;
    const windowEnd = windowStart + windowMs;
    const count = steps.filter(
      (other) => other.atMs >= windowStart && other.atMs < windowEnd && other.decision.allowed,
    ).length;
    return Math.max(max, count);
  }, 0);

  return (
    <div
      ref={containerRef}
      class="rx-console"
      role="region"
      aria-label="Interactive Rate Limiter Console"
    >
      {/* Screen Reader Live Region */}
      <div class="rx-sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Header Strip: Algorithm Tabs and Status */}
      <div class="rx-console__header">
        <div class="rx-console__tabs" ref={tabsContainerRef} role="tablist" aria-label="Algorithms">
          {tabIndicatorStyle.visible && (
            <span
              class="rx-console__tab-indicator"
              aria-hidden="true"
              style={{
                transform: `translate3d(${tabIndicatorStyle.left}px, -50%, 0)`,
                width: `${tabIndicatorStyle.width}px`,
              }}
            />
          )}

          {algorithms.map((algo) => {
            const isAvailable = algo.id === 'fixed-window' || algo.id === 'token-bucket';
            const isSelected = algo.id === selectedAlgo;
            const isNudging = nudgingTab === algo.id;

            return (
              <button
                key={algo.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                aria-disabled={!isAvailable}
                onClick={() => handleTabClick(algo.id, isAvailable)}
                class={`rx-console__tab ${isSelected ? 'is-active' : ''} ${
                  !isAvailable ? 'is-disabled' : ''
                } ${isNudging ? 'is-nudging' : ''}`}
                title={
                  isAvailable
                    ? `${algo.name} (Active)`
                    : `${algo.name} (Planned — Arriving Days 5-7)`
                }
              >
                <span>{algo.name}</span>
                {!isAvailable && <span class="rx-console__tab-chip">Planned</span>}
              </button>
            );
          })}
        </div>

        <div class="rx-console__meta">
          <span class="rx-console__spec">
            limit {limit} per {(windowMs / 1000).toFixed(0)}s
          </span>
          <span class="rx-console__time">t = {(currentMs / 1000).toFixed(2)}s</span>
          <span class="rx-console__badge-sim">
            <span class="rx-console__sim-dot" aria-hidden="true"></span>
            Simulated
          </span>
        </div>
      </div>

      {/* Timeline Visualisation with E12 wipe transition */}
      <div class={`rx-console__timeline-wrapper ${isWiping ? 'is-wiping' : ''}`}>
        <Timeline
          variant="hero"
          currentMs={currentMs}
          windowMs={windowMs}
          limit={limit}
          steps={steps}
          latestStepIndex={latestStep?.index}
          pulseEvent={pulseEvent}
        />
      </div>

      {/* Readout Row (Tabular Metrics with E10 Odometers and Cell Tint Flash) */}
      <div class="rx-console__readouts" aria-label="Real-time State Metrics">
        <div class={`rx-readout ${flashType === 'allowed' ? 'flash-allowed' : ''}`}>
          <span class="rx-readout__label">ALLOWED</span>
          <NumericValue
            value={allowedCount}
            className="rx-readout__val rx-readout__val--allowed"
          />
        </div>
        <div class={`rx-readout ${flashType === 'denied' ? 'flash-denied' : ''}`}>
          <span class="rx-readout__label">DENIED</span>
          <NumericValue
            value={deniedCount}
            className="rx-readout__val rx-readout__val--denied"
          />
        </div>
        <div class={`rx-readout ${flashType === 'allowed' ? 'flash-allowed' : ''}`}>
          <span class="rx-readout__label">REMAINING</span>
          <span class="rx-readout__val">
            <NumericValue value={remaining} /> / {limit}
          </span>
        </div>
        <div class="rx-readout">
          <span class="rx-readout__label">RESET IN</span>
          <span class="rx-readout__val">
            <NumericValue value={`${resetInSec}s`} />
          </span>
        </div>
        <div class="rx-readout">
          <span class="rx-readout__label">RETRY-AFTER</span>
          <span class="rx-readout__val">
            {retryAfterMs > 0 ? <NumericValue value={`${(retryAfterMs / 1000).toFixed(1)}s`} /> : '—'}
          </span>
        </div>
        <div class="rx-readout">
          <span class="rx-readout__label">PEAK (WINDOW)</span>
          <NumericValue value={peakInWindow} className="rx-readout__val" />
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div class="rx-console__controls">
        <div class="rx-console__actions">
          <button type="button" class="rx-btn rx-btn--primary" onClick={sendRequest}>
            Send request
          </button>

          <button type="button" class="rx-btn rx-btn--secondary" onClick={sendBurst}>
            Send burst (+{limit + 2})
          </button>

          <button
            type="button"
            class="rx-btn rx-btn--ghost"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-pressed={isPlaying}
          >
            {isPlaying ? 'Pause' : 'Play simulation'}
          </button>

          <button type="button" class="rx-btn rx-btn--ghost" onClick={resetEngine}>
            Reset
          </button>
        </div>

        <button
          type="button"
          class="rx-console__log-toggle"
          aria-expanded={showLog}
          onClick={() => setShowLog(!showLog)}
        >
          {showLog ? 'Hide decision log' : `Decision log (${steps.length})`}
        </button>
      </div>

      {/* Decision Log Table (Accessible Equivalent) */}
      {showLog && (
        <div class="rx-console__log-panel">
          <table class="rx-log-table">
            <caption class="rx-sr-only">Sequential record of evaluated decisions</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Time</th>
                <th scope="col">Key</th>
                <th scope="col">Status</th>
                <th scope="col">Remaining</th>
                <th scope="col">Reset</th>
                <th scope="col">Retry-After</th>
              </tr>
            </thead>
            <tbody>
              {steps
                .slice(-20)
                .reverse()
                .map((s) => (
                  <tr key={s.index} class={s.decision.allowed ? 'rx-log-allowed' : 'rx-log-denied'}>
                    <td class="rx-mono">{s.index}</td>
                    <td class="rx-mono">{(s.atMs / 1000).toFixed(2)}s</td>
                    <td class="rx-mono">{s.action.key}</td>
                    <td>
                      <span
                        class={`rx-log-chip ${s.decision.allowed ? 'is-allowed' : 'is-denied'}`}
                      >
                        {s.decision.allowed ? 'ALLOWED' : 'DENIED'}
                      </span>
                    </td>
                    <td class="rx-mono">
                      {s.decision.remaining}/{s.decision.limit}
                    </td>
                    <td class="rx-mono">{(s.decision.resetAtMs / 1000).toFixed(1)}s</td>
                    <td class="rx-mono">
                      {s.decision.retryAfterMs
                        ? `${(s.decision.retryAfterMs / 1000).toFixed(1)}s`
                        : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footnote Caption */}
      <p class="rx-console__caption">
        Simulated time. This is the real @reqnx/core library running in your browser.
      </p>
    </div>
  );
}

export default LiveConsole;
