/**
 * Unit tests for `lib/analytics/risk`.
 *
 * Coverage map (matches the assignment):
 *   1.  valueAtRisk — hand-computed 10-element example
 *   2.  conditionalVaR — same
 *   3.  sharpeRatio — known closed-form answer
 *   4.  sortinoRatio — same series, hand-checked
 *   5.  maxDrawdown — synthetic curve with known peak/trough/recovery
 *   6.  calmarRatio — closed-form
 *   7.  annualizedVolatility — sqrt(252) scaling sanity check
 *   8.  computeRiskReport — full pipeline on synthetic data
 *   9.  Edge cases — empty, all-zero, single-element, monotonic up/down
 *   10. Real-data fixture — synthesized small backtest, shape verified
 *
 * Test values are computed by hand or with closed-form algebra so a
 * regression in the math layer shows up immediately.
 */

import { describe, it, expect } from 'vitest';

import {
  annualizedVolatility,
  burkeRatio,
  calmarRatio,
  computeRiskReport,
  conditionalVaR,
  maxDrawdown,
  sampleStddev,
  sharpeRatio,
  simpleReturns,
  sortinoRatio,
  ulcerIndex,
  valueAtRisk,
} from '../lib/analytics/risk';
import type { EquityPoint, RiskReport } from '../lib/analytics/risk-types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Fuzzy equality with an explicit tolerance. */
function close(a: number, b: number, tol: number = 1e-9): boolean {
  return Math.abs(a - b) <= tol;
}

/**
 * The canonical example used across the assignment:
 *   returns = [0.01, 0.02, -0.01, 0.015, 0.005],  rf = 0, N = 252
 *
 * Hand-computed:
 *   mean = 0.008
 *   Σ (x − 0.008)^2 = 0.000004 + 0.000144 + 0.000324 + 0.000049 + 0.000009
 *                   = 0.000530
 *   sampleStddev = sqrt(0.000530 / 4) ≈ 0.01151036
 *   sharpe = (0.008 × sqrt(252)) / 0.01151036 ≈ 11.0338...
 */
const KNOWN_RETURNS = [0.01, 0.02, -0.01, 0.015, 0.005] as const;

const KNOWN_SAMPLE_STDDEV = Math.sqrt(0.000530 / 4);
const KNOWN_MEAN = 0.008;
const KNOWN_SHARPE = (KNOWN_MEAN * Math.sqrt(252)) / KNOWN_SAMPLE_STDDEV;

// ---------------------------------------------------------------------------
// 1. valueAtRisk
// ---------------------------------------------------------------------------

describe('valueAtRisk (historical simulation)', () => {
  it('returns NaN on an empty input', () => {
    expect(valueAtRisk([])).toBeNaN();
  });

  it('matches the hand-computed 5th-percentile loss on a 10-element ladder', () => {
    // Sorted ascending; the 5th percentile sits between elements [0]=-0.05
    // and [1]=-0.03 → linear interpolation:
    //   idx = 0.05 * (10 - 1) = 0.45
    //   q   = -0.05 * 0.55 + -0.03 * 0.45 = -0.041
    // VaR = -q = 0.041
    const returns = [-0.05, -0.03, -0.01, 0.0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06];
    const var95 = valueAtRisk(returns, 0.95);
    expect(close(var95, 0.041, 1e-9)).toBe(true);
  });

  it('returns a POSITIVE number (loss magnitude convention)', () => {
    const returns = [-0.10, -0.05, 0.02, 0.03, 0.04];
    expect(valueAtRisk(returns, 0.95)).toBeGreaterThan(0);
  });

  it('99% VaR is >= 95% VaR (tail risk is monotone)', () => {
    const returns = [-0.12, -0.08, -0.03, 0.01, 0.02, 0.04, 0.05, 0.06, 0.07, 0.08];
    expect(valueAtRisk(returns, 0.99)).toBeGreaterThanOrEqual(valueAtRisk(returns, 0.95));
  });

  it('clamps confidence to (0,1) without throwing', () => {
    const returns = [-0.05, 0.0, 0.05];
    expect(Number.isFinite(valueAtRisk(returns, 0))).toBe(true);
    expect(Number.isFinite(valueAtRisk(returns, 1))).toBe(true);
    expect(Number.isFinite(valueAtRisk(returns, -1))).toBe(true);
    expect(Number.isFinite(valueAtRisk(returns, 2))).toBe(true);
  });

  it('handles a single-element input gracefully', () => {
    expect(valueAtRisk([0.05])).toBe(-0.05); // quantile of length-1 = that value
  });
});

// ---------------------------------------------------------------------------
// 2. conditionalVaR
// ---------------------------------------------------------------------------

describe('conditionalVaR', () => {
  it('returns NaN on an empty input', () => {
    expect(conditionalVaR([])).toBeNaN();
  });

  it('averages the worst tail losses for the 10-element ladder', () => {
    // VaR95 cutoff (5th percentile, linear interp) = -0.041.
    // All returns ≤ -0.041: just -0.05. So CVaR = 0.05.
    const returns = [-0.05, -0.03, -0.01, 0.0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06];
    expect(close(conditionalVaR(returns, 0.95), 0.05, 1e-9)).toBe(true);
  });

  it('CVaR is >= VaR for the same series (tail mean dominates worst-case)', () => {
    const returns = [-0.10, -0.05, -0.03, 0.0, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07];
    const var95 = valueAtRisk(returns, 0.95);
    const cvar95 = conditionalVaR(returns, 0.95);
    expect(cvar95).toBeGreaterThanOrEqual(var95 - 1e-12);
  });

  it('returns the worst single loss when only one observation lies in the tail', () => {
    const returns = [-0.20, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09];
    // 99% VaR cutoff is very deep; only the worst loss qualifies. CVaR = 0.20.
    const cvar = conditionalVaR(returns, 0.99);
    expect(close(cvar, 0.20, 1e-9)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. sharpeRatio
// ---------------------------------------------------------------------------

describe('sharpeRatio', () => {
  it('matches the hand-computed value on the canonical series (rf=0)', () => {
    const s = sharpeRatio(KNOWN_RETURNS, 0, 252);
    expect(close(s, KNOWN_SHARPE, 1e-9)).toBe(true);
  });

  it('returns 0 for length < 2', () => {
    expect(sharpeRatio([], 0)).toBe(0);
    expect(sharpeRatio([0.05], 0)).toBe(0);
  });

  it('returns 0 (not Infinity) when stddev is 0 (all returns identical)', () => {
    expect(sharpeRatio([0.01, 0.01, 0.01, 0.01], 0)).toBe(0);
  });

  it('applies the sqrt(N) annualization', () => {
    const s = sharpeRatio(KNOWN_RETURNS, 0, 252);
    const sAlt = sharpeRatio(KNOWN_RETURNS, 0, 1); // unannualized
    // ratio of the two should be exactly sqrt(252).
    expect(close(s / sAlt, Math.sqrt(252), 1e-9)).toBe(true);
  });

  it('returns a negative number when mean return < rf', () => {
    // mean is 0.008; rf/252 ≈ 0.05 → per-period rf ≈ 0.000198 (still below 0.008)
    // Use rf = 0.05 * 252 to force mean < rf.
    const s = sharpeRatio(KNOWN_RETURNS, 12.6, 252);
    expect(s).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. sortinoRatio
// ---------------------------------------------------------------------------

describe('sortinoRatio', () => {
  it('matches the hand-computed value on the canonical series (rf=0)', () => {
    // Downside deviation (full-denominator Sortino convention):
    //   sum(min(r,0)^2) = (-0.01)^2 = 0.0001
    //   ddev = sqrt(0.0001 / 5) ≈ 0.0044721
    const ddev = Math.sqrt(0.0001 / 5);
    const expected = (KNOWN_MEAN * Math.sqrt(252)) / ddev;
    const s = sortinoRatio(KNOWN_RETURNS, 0, 252);
    expect(close(s, expected, 1e-9)).toBe(true);
  });

  it('Sortino >= Sharpe when stddev is dominated by upside noise', () => {
    const returns = [0.01, 0.02, -0.01, 0.015, 0.005];
    expect(sortinoRatio(returns, 0)).toBeGreaterThan(sharpeRatio(returns, 0));
  });

  it('returns 0 when no observation is below the target (no downside)', () => {
    expect(sortinoRatio([0.01, 0.02, 0.03, 0.04], 0)).toBe(0);
  });

  it('returns 0 for length < 2', () => {
    expect(sortinoRatio([])).toBe(0);
    expect(sortinoRatio([0.01])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. maxDrawdown
// ---------------------------------------------------------------------------

describe('maxDrawdown', () => {
  it('finds a 20% drawdown between peak and trough on a synthetic curve', () => {
    // Peak = 100 at index 1; trough = 80 at index 2; recovery at index 3
    // (105 ≥ 100).
    const curve = [90, 100, 80, 105, 110];
    const dd = maxDrawdown(curve);
    expect(close(dd.maxDrawdownPct, 0.20, 1e-12)).toBe(true);
    expect(dd.maxDrawdownStart).toBe(1);
    expect(dd.maxDrawdownEnd).toBe(2);
    expect(dd.recoveryIndex).toBe(3);
  });

  it('returns 0 drawdown for a monotonically increasing curve', () => {
    const curve = [10, 20, 30, 40, 50];
    const dd = maxDrawdown(curve);
    expect(dd.maxDrawdownPct).toBe(0);
    // When there's never a drawdown, the recovery index is the last point
    // (the peak has never been breached).
    expect(dd.recoveryIndex).toBe(curve.length - 1);
  });

  it('handles a 100% drawdown (ruin): magnitude=1, recoveryIndex=null', () => {
    const curve = [100, 80, 50, 0, 0, 0, 0];
    const dd = maxDrawdown(curve);
    expect(close(dd.maxDrawdownPct, 1.0, 1e-12)).toBe(true);
    expect(dd.maxDrawdownStart).toBe(0);
    expect(dd.maxDrawdownEnd).toBeGreaterThanOrEqual(3);
    expect(dd.recoveryIndex).toBeNull();
  });

  it('returns 0 magnitude for empty and length-1 inputs', () => {
    expect(maxDrawdown([]).maxDrawdownPct).toBe(0);
    expect(maxDrawdown([42]).maxDrawdownPct).toBe(0);
  });

  it('finds the drawdown starting from the most-recent peak (not a global peak)', () => {
    // Two peaks: index 0 (100) and index 4 (200). Drawdown from index 4 to
    // index 6 (140) = 30% > drawdown from index 0 to index 1 (20%)? no,
    // wait: 100→80 = 20%; 200→140 = 30%. So the answer should anchor on
    // index 4.
    const curve = [100, 80, 90, 110, 200, 140, 180];
    const dd = maxDrawdown(curve);
    expect(close(dd.maxDrawdownPct, 0.30, 1e-12)).toBe(true);
    expect(dd.maxDrawdownStart).toBe(4);
    expect(dd.maxDrawdownEnd).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 6. calmarRatio
// ---------------------------------------------------------------------------

describe('calmarRatio', () => {
  it('matches the closed-form answer for known inputs', () => {
    // 252 daily returns, each +0.10% per day:
    //   totalReturn       = (1.001)^252 − 1 ≈ 0.28479…
    //   annualizedReturn  = (1.28479…)^(252/252) − 1 ≈ 0.28479…
    //   calmar            = 0.28479… / 0.10 ≈ 2.8479…
    const returns = new Array(252).fill(0.001);
    const calmar = calmarRatio(returns, 0.10, 252);
    const expectedTotal = Math.pow(1.001, 252) - 1;
    const expectedCalmar = expectedTotal / 0.10;
    expect(close(calmar, expectedCalmar, 1e-9)).toBe(true);
  });

  it('returns 0 (not Infinity) when drawdown is 0', () => {
    expect(calmarRatio([0.01, 0.02, 0.03], 0)).toBe(0);
  });

  it('returns 0 for length < 2', () => {
    expect(calmarRatio([], 0.10)).toBe(0);
    expect(calmarRatio([0.01], 0.10)).toBe(0);
  });

  it('uses |maxDrawdownPct| in the denominator (sign-safe)', () => {
    const returns = new Array(100).fill(0.01);
    const pos = calmarRatio(returns, 0.05, 252);
    const neg = calmarRatio(returns, -0.05, 252);
    expect(close(pos, neg, 1e-12)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. annualizedVolatility
// ---------------------------------------------------------------------------

describe('annualizedVolatility', () => {
  it('applies the sqrt(N) scaling', () => {
    // For a 10-element series of constant 0.01: stddev = 0 → vol = 0.
    // For a series with variance: vol(N=252) should equal vol(N=1) × sqrt(252).
    const returns = KNOWN_RETURNS;
    const v252 = annualizedVolatility(returns, 252);
    const v1 = annualizedVolatility(returns, 1);
    expect(close(v252, v1 * Math.sqrt(252), 1e-12)).toBe(true);
  });

  it('matches the closed-form for KNOWN_RETURNS at N=252', () => {
    const v = annualizedVolatility(KNOWN_RETURNS, 252);
    expect(close(v, KNOWN_SAMPLE_STDDEV * Math.sqrt(252), 1e-12)).toBe(true);
  });

  it('returns 0 for length < 2', () => {
    expect(annualizedVolatility([])).toBe(0);
    expect(annualizedVolatility([0.05])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. computeRiskReport (full pipeline)
// ---------------------------------------------------------------------------

describe('computeRiskReport', () => {
  it('produces a fully populated report on a synthetic equity curve', () => {
    // Build a curve that: starts at 100, peaks at 110, dips to 88, recovers
    // to 105. Total return = 5%, max DD = 20%.
    const values = [100, 105, 110, 88, 92, 98, 105];
    const report = computeRiskReport(values, 0, 252);

    expect(report.sampleSize).toBe(values.length - 1);
    expect(close(report.totalReturn, 0.05, 1e-12)).toBe(true);
    expect(report.maxDrawdown).toBeGreaterThan(0.19);
    expect(report.maxDrawdown).toBeLessThan(0.21);
    expect(report.annualizedReturn).toBeGreaterThan(0);
    expect(report.sharpeRatio).toBeDefined();
    expect(report.sortinoRatio).toBeDefined();
    expect(report.calmarRatio).toBeGreaterThan(0);
    expect(report.valueAtRisk95).toBeGreaterThanOrEqual(0);
    expect(report.valueAtRisk99).toBeGreaterThanOrEqual(report.valueAtRisk95 - 1e-12);
    expect(report.conditionalVaR95).toBeGreaterThanOrEqual(0);
    expect(report.ulcerIndex).toBeGreaterThan(0);
    expect(report.annualizationFactor).toBe(252);
    expect(report.riskFreeRate).toBe(0);
  });

  it('accepts the {timestamp, lpValue} shape used by the backtest', () => {
    const curve: EquityPoint[] = [
      { timestamp: 1700000000000, lpValue: 100 },
      { timestamp: 1700000864000, lpValue: 105 },
      { timestamp: 1700001728000, lpValue: 110 },
      { timestamp: 1700002592000, lpValue: 88 },
      { timestamp: 1700003456000, lpValue: 105 },
    ];
    const report = computeRiskReport(curve, 0.05, 365);
    expect(report.annualizationFactor).toBe(365);
    expect(report.riskFreeRate).toBe(0.05);
    expect(report.sampleSize).toBe(4);
    expect(close(report.totalReturn, 0.05, 1e-12)).toBe(true);
  });

  it('echoes the caller-supplied riskFreeRate and annualizationFactor', () => {
    const r = computeRiskReport([100, 110, 120], 0.04, 365);
    expect(r.riskFreeRate).toBe(0.04);
    expect(r.annualizationFactor).toBe(365);
  });

  it('the report is a structurally complete object — no undefined fields', () => {
    const r = computeRiskReport([100, 110, 120, 130]);
    const required: (keyof RiskReport)[] = [
      'totalReturn', 'annualizedReturn', 'annualizedVolatility',
      'sharpeRatio', 'sortinoRatio', 'maxDrawdown', 'calmarRatio',
      'valueAtRisk95', 'valueAtRisk99', 'conditionalVaR95', 'conditionalVaR99',
      'ulcerIndex', 'burkeRatio', 'sampleSize',
      'annualizationFactor', 'riskFreeRate',
    ];
    for (const k of required) {
      expect(r[k]).toBeDefined();
      expect(Number.isFinite(r[k] as number)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('empty array → ratios 0, stddev 0, no throw', () => {
    expect(sampleStddev([])).toBe(0);
    expect(sharpeRatio([])).toBe(0);
    expect(sortinoRatio([])).toBe(0);
    expect(calmarRatio([], 0.10)).toBe(0);
    expect(annualizedVolatility([])).toBe(0);
    expect(maxDrawdown([]).maxDrawdownPct).toBe(0);
    expect(ulcerIndex([])).toBe(0);
    expect(burkeRatio([], 0)).toBe(0);
    // VaR/CVaR are NaN — caller can branch.
    expect(valueAtRisk([])).toBeNaN();
    expect(conditionalVaR([])).toBeNaN();
  });

  it('all-zero returns → ratios 0 (no Infinity)', () => {
    const r = [0, 0, 0, 0, 0];
    expect(sharpeRatio(r)).toBe(0);
    expect(sortinoRatio(r)).toBe(0);
    expect(calmarRatio(r, 0.10)).toBe(0);
    expect(annualizedVolatility(r)).toBe(0);
    expect(valueAtRisk(r, 0.95)).toBe(0);
    expect(conditionalVaR(r, 0.95)).toBe(0);
  });

  it('single-element array → ratios 0, totalReturn 0', () => {
    const r = computeRiskReport([100]);
    expect(r.totalReturn).toBe(0);
    expect(r.annualizedReturn).toBe(0);
    expect(r.sharpeRatio).toBe(0);
    expect(r.sampleSize).toBe(0);
  });

  it('monotonically increasing curve → max DD 0, totalReturn > 0', () => {
    const r = computeRiskReport([100, 110, 121, 133.1, 146.41]); // +10% daily
    expect(r.maxDrawdown).toBe(0);
    expect(r.ulcerIndex).toBe(0);
    expect(r.burkeRatio).toBe(0);
    // Identical returns → stddev = 0 → Sharpe = 0 (not Infinity).
    expect(r.sharpeRatio).toBe(0);
    expect(r.totalReturn).toBeGreaterThan(0);
  });

  it('monotonically decreasing curve → max DD > 0, sharpe <= 0', () => {
    // 100 → 65.61 is a ~34% drawdown from the start, not 50%.
    const r = computeRiskReport([100, 90, 81, 72.9, 65.61]);
    expect(r.maxDrawdown).toBeGreaterThan(0.3);
    expect(r.maxDrawdown).toBeLessThan(0.4);
    expect(r.totalReturn).toBeLessThan(0);
    expect(r.sharpeRatio).toBeLessThanOrEqual(0);
  });

  it('simpleReturns drops invalid samples gracefully', () => {
    //   100 → 0   : prev>0, curr finite → KEPT (-100% loss)
    //   0   → 50  : prev<=0 → DROPPED
    //   50  → NaN : curr not finite → DROPPED
    //   NaN → 60  : prev not finite → DROPPED
    const curve = [100, 0, 50, NaN, 60];
    const rets = simpleReturns(curve);
    expect(rets.length).toBe(1);
    expect(close(rets[0]!, -1.0, 1e-12)).toBe(true);
  });

  it('simpleReturns handles a clean up-only series', () => {
    const rets = simpleReturns([100, 110, 121]);
    expect(rets.length).toBe(2);
    expect(close(rets[0]!, 0.10, 1e-12)).toBe(true);
    expect(close(rets[1]!, 0.10, 1e-12)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Real-data fixture: synthesized backtest curve
// ---------------------------------------------------------------------------

describe('real-data fixture (synthesized)', () => {
  it('produces a stable RiskReport on a 60-day LP curve', () => {
    // Generate a 60-day LP curve that resembles an LP position: roughly
    // +0.5% per day with ±2% daily noise and one 15% drawdown episode.
    const values: number[] = [10000];
    let v = 10000;
    let peak = 10000;
    const rng = mulberry32(0x1337c0de); // deterministic
    for (let i = 0; i < 60; i++) {
      // Baseline +0.5% per day with ±2% noise.
      const noise = (rng() - 0.5) * 0.04; // ±2%
      const drift = 0.005;
      v = v * (1 + drift + noise);
      // Inject a drawdown episode on days 20-30.
      if (i >= 20 && i <= 30) v *= 0.985;
      peak = Math.max(peak, v);
      values.push(v);
    }

    const report = computeRiskReport(values, 0.04, 365);

    // Structural checks (the exact magnitudes depend on RNG state, so we
    // only check that the report is sane, not that a specific value matches).
    expect(report.sampleSize).toBe(60);
    expect(Number.isFinite(report.totalReturn)).toBe(true);
    expect(Number.isFinite(report.annualizedReturn)).toBe(true);
    expect(report.annualizedVolatility).toBeGreaterThan(0);
    expect(report.maxDrawdown).toBeGreaterThan(0);
    expect(report.maxDrawdown).toBeLessThan(0.5); // sanity bound
    expect(report.valueAtRisk95).toBeGreaterThan(0);
    expect(report.valueAtRisk99).toBeGreaterThanOrEqual(report.valueAtRisk95 - 1e-12);
    expect(report.conditionalVaR95).toBeGreaterThanOrEqual(report.valueAtRisk95 - 1e-12);
    expect(report.ulcerIndex).toBeGreaterThan(0);
    expect(report.annualizationFactor).toBe(365);
    expect(report.riskFreeRate).toBe(0.04);

    // Determinism: re-running the report must yield the same numbers.
    const again = computeRiskReport(values, 0.04, 365);
    for (const k of Object.keys(report) as (keyof RiskReport)[]) {
      expect(again[k]).toBe(report[k]);
    }
  });
});

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — keeps the fixture test reproducible.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}