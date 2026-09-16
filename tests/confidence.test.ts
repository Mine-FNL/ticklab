/**
 * Confidence-bands engine unit tests.
 *
 * Covers `computeConfidenceBands`, `rollingWindows`, and `compoundWindowReturns`
 * from `lib/simulation/confidence`. Determinism is enforced by passing an
 * explicit `seed` to the PRNG path.
 */

import { describe, it, expect } from 'vitest';
import {
  computeConfidenceBands,
  compoundWindowReturns,
  rollingWindows,
} from '../lib/simulation/confidence';

describe('computeConfidenceBands', () => {
  it('returns sensible bands for a known input (1..10)', () => {
    const bands = computeConfidenceBands(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      { seed: 42 }
    );
    expect(bands.n).toBe(10);
    expect(bands.mean).toBeCloseTo(5.5, 10);
    expect(bands.p50).toBeCloseTo(5.5, 1);
    // type-7 linear interp on [1..10]: q = 9 * 0.05 = 0.45 → 1 + 0.45 * (2-1) = 1.45
    expect(bands.p5).toBeCloseTo(1.45, 1);
    // q = 9 * 0.95 = 8.55 → 9 + 0.55 * (10-9) = 9.55
    expect(bands.p95).toBeCloseTo(9.55, 1);
    expect(bands.p25).toBeCloseTo(3.25, 1);
    expect(bands.p75).toBeCloseTo(7.75, 1);
    expect(bands.bestWindow).toBe(10);
    expect(bands.worstWindow).toBe(1);
    expect(bands.worstDrawdown).toBe(1);
    expect(bands.probabilityOfLoss).toBe(0);
    expect(bands.ci90).toEqual([bands.p5, bands.p95]);
    expect(bands.ci50).toEqual([bands.p25, bands.p75]);
    // stdDev should be positive (sample stddev, ~2.872)
    expect(bands.stdDev).toBeGreaterThan(2.5);
    expect(bands.stdDev).toBeLessThan(3.5);
  });

  it('is deterministic with the same seed (n<30 bootstrap path)', () => {
    const series = [0.05, -0.02, 0.08, -0.04, 0.03, 0.07, -0.01, 0.06, 0.02, -0.03];
    const a = computeConfidenceBands(series, { seed: 12345 });
    const b = computeConfidenceBands(series, { seed: 12345 });
    expect(a).toEqual(b);
    expect(a.n).toBe(10);
  });

  it('counts probabilityOfLoss correctly', () => {
    const bands = computeConfidenceBands(
      [-0.1, -0.05, 0.0, 0.05, 0.1, 0.15, -0.2, 0.02],
      { seed: 1 }
    );
    // 3 of 8 windows are strictly negative
    expect(bands.probabilityOfLoss).toBeCloseTo(3 / 8, 10);
    expect(bands.worstWindow).toBe(-0.2);
    expect(bands.worstDrawdown).toBe(-0.2);
    expect(bands.bestWindow).toBe(0.15);
  });

  it('skips bootstrap when n>=30 (percentiles match sample)', () => {
    const series = Array.from({ length: 30 }, (_, i) => i + 1);
    const bands = computeConfidenceBands(series);
    expect(bands.n).toBe(30);
    expect(bands.mean).toBeCloseTo(15.5, 10);
    // type-7 on [1..30]: q = 29 * 0.5 = 14.5 → 15 + 0.5*(16-15) = 15.5
    expect(bands.p50).toBeCloseTo(15.5, 10);
    // q = 29 * 0.05 = 1.45 → sorted[1] + 0.45*(sorted[2]-sorted[1]) = 2 + 0.45 = 2.45
    expect(bands.p5).toBeCloseTo(2.45, 1);
    // q = 29 * 0.95 = 27.55 → 28 + 0.55*(29-28) = 28.55
    expect(bands.p95).toBeCloseTo(28.55, 1);
  });
});

describe('compoundWindowReturns', () => {
  it('compounds a 1-day window (default stride=windowSize)', () => {
    const out = compoundWindowReturns([0.01, -0.005, 0.02], 1);
    // Float-precision: use approximate comparison rather than `toEqual`.
    expect(out.length).toBe(3);
    expect(out[0]).toBeCloseTo(0.01, 10);
    expect(out[1]).toBeCloseTo(-0.005, 10);
    expect(out[2]).toBeCloseTo(0.02, 10);
  });

  it('compounds a 3-day window with stride=1', () => {
    const out = compoundWindowReturns([0.01, -0.005, 0.02], 3, { stride: 1 });
    // Only one window starting at index 0: (1.01)(0.995)(1.02) - 1
    expect(out.length).toBe(1);
    const expected = 1.01 * 0.995 * 1.02 - 1;
    expect(out[0]).toBeCloseTo(expected, 10);
    // numeric value sanity check
    expect(out[0]).toBeCloseTo(0.025049, 8);
  });

  it('produces empty array when series shorter than windowSize', () => {
    const out = compoundWindowReturns([0.01, 0.02], 5);
    expect(out).toEqual([]);
  });
});

describe('rollingWindows', () => {
  it('with stride=2 gives the right window count', () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const windows = rollingWindows(series, 3, { stride: 2 });
    // starts at 0, 2, 4, 6 (8 → 8+3=11 > 10, stop)
    expect(windows.length).toBe(4);
    expect(windows[0]).toEqual([1, 2, 3]);
    expect(windows[1]).toEqual([3, 4, 5]);
    expect(windows[2]).toEqual([5, 6, 7]);
    expect(windows[3]).toEqual([7, 8, 9]);
  });

  it('non-overlapping by default (stride = windowSize)', () => {
    const series = [1, 2, 3, 4, 5, 6];
    const windows = rollingWindows(series, 2);
    expect(windows).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('throws when minWindows is not met', () => {
    expect(() => rollingWindows([1, 2, 3], 2, { minWindows: 5 })).toThrow(
      /need at least 5/
    );
  });
});

describe('input validation', () => {
  it('rejects fewer than 5 windows with the documented error', () => {
    expect(() => computeConfidenceBands([1, 2, 3, 4])).toThrow(
      /need at least 5 windows for meaningful confidence bands/
    );
  });

  it('rejects unsorted percentile config', () => {
    expect(() =>
      computeConfidenceBands([1, 2, 3, 4, 5], { percentiles: [50, 5, 95] })
    ).toThrow(/sorted strictly ascending/);
  });

  it('rejects percentile duplicates', () => {
    expect(() =>
      computeConfidenceBands([1, 2, 3, 4, 5], { percentiles: [10, 10, 50] })
    ).toThrow(/sorted strictly ascending/);
  });

  it('rejects percentile out of [0, 100]', () => {
    expect(() =>
      computeConfidenceBands([1, 2, 3, 4, 5], { percentiles: [0, 50, 101] })
    ).toThrow(/must be in \[0, 100\]/);
    expect(() =>
      computeConfidenceBands([1, 2, 3, 4, 5], { percentiles: [-1, 50] })
    ).toThrow(/must be in \[0, 100\]/);
  });

  it('rejects bootstrapSamples out of range', () => {
    expect(() =>
      computeConfidenceBands([1, 2, 3, 4, 5], { bootstrapSamples: 0 })
    ).toThrow(/must be an integer in \[1, 10000\]/);
    expect(() =>
      computeConfidenceBands([1, 2, 3, 4, 5], { bootstrapSamples: 10001 })
    ).toThrow(/must be an integer in \[1, 10000\]/);
  });
});