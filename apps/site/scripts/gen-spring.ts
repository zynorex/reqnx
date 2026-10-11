// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/gen-spring.ts
//
// Generates a CSS linear() easing curve approximating an underdamped spring
// with overshoot strictly <= 4%.
//
// Spring formula:
//   x(t) = 1 - exp(-zeta * omega * t) * (cos(omega_d * t) + (zeta / sqrt(1 - zeta^2)) * sin(omega_d * t))
// where:
//   zeta = damping ratio (~0.8 for ~3.5% overshoot)
//   omega = natural frequency
// ──────────────────────────────────────────────────────────────────────────────

export interface SpringConfig {
  /** Damping ratio (0 < zeta < 1). 0.8 yields ~3.5% overshoot. */
  zeta?: number;
  /** Natural frequency in rad/s. Default 14. */
  omega?: number;
  /** Duration of the normalized timeline in seconds. Default 0.7. */
  duration?: number;
  /** Number of sample points for the linear() polynomial. Default 32. */
  samples?: number;
}

export function computeSpringPoints(config: SpringConfig = {}): number[] {
  const zeta = config.zeta ?? 0.8;
  const omega = config.omega ?? 14;
  const duration = config.duration ?? 0.7;
  const samples = config.samples ?? 32;

  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const factor = zeta / Math.sqrt(1 - zeta * zeta);

  const points: number[] = [];

  for (let i = 0; i <= samples; i++) {
    const progress = i / samples;
    const t = progress * duration;

    // Standard analytical step response of a 2nd order underdamped system
    const decay = Math.exp(-zeta * omega * t);
    const oscillation = Math.cos(omegaD * t) + factor * Math.sin(omegaD * t);
    const value = 1 - decay * oscillation;

    // Round to 4 decimal places
    points.push(Math.round(value * 10000) / 10000);
  }

  // Force exact boundaries
  points[0] = 0;
  points[points.length - 1] = 1;

  return points;
}

export function generateLinearSpringCss(config: SpringConfig = {}): string {
  const points = computeSpringPoints(config);
  return `linear(${points.join(', ')})`;
}

if (import.meta.url.endsWith(process.argv[1] || '')) {
  console.log(generateLinearSpringCss());
}
