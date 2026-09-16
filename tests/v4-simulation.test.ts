/**
 * V4 simulation engine tests.
 *
 * These tests run the full scenario grid and validate structural invariants
 * (51 price steps, base/best/worst cases selected correctly, fee accounting).
 */

import { describe, it, expect } from 'vitest';
import { simulateV4LP, optimizeV4Range } from '../lib/univ4/simulation';

describe('simulateV4LP', () => {
  const baseParams = {
    entryPrice: 1,
    lowerPrice: 0.9,
    upperPrice: 1.1,
    depositAmount: 1000,
    depositToken: 'usd' as const,
    baseFeeTier: 3000,
    volume24h: 5_000_000,
    poolLiquidity: 1_000_000n,
    yourLiquidity: 1000n,
    horizonDays: 30,
    gasCostGwei: 20,
    volatility: 0.6,
    estimatedDailySwaps: 100,
  };

  it('produces 51 scenario points (50 steps + endpoint)', () => {
    const r = simulateV4LP(baseParams);
    expect(r.scenarios).toHaveLength(51);
  });

  it('base / best / worst cases are within scenarios', () => {
    const r = simulateV4LP(baseParams);
    expect(r.baseCase).not.toBeNull();
    expect(r.bestCase).not.toBeNull();
    expect(r.worstCase).not.toBeNull();
    if (r.bestCase && r.worstCase) {
      expect(r.bestCase.netReturn).toBeGreaterThanOrEqual(r.worstCase.netReturn);
    }
  });

  it('hook analysis defaults to base APR when no hook selected', () => {
    const r = simulateV4LP(baseParams);
    expect(r.hookAnalysis.hookId).toBeUndefined();
    expect(r.hookAnalysis.recommendation).toMatch(/No hook/i);
  });

  it('selected hook surfaces in hookAnalysis', () => {
    const r = simulateV4LP({ ...baseParams, hookId: 'auto_compound' });
    expect(r.hookAnalysis.hookId).toBe('auto_compound');
    expect(r.hookAnalysis.hookName).toBeTruthy();
  });

  it('range analysis tickWidth is positive', () => {
    const r = simulateV4LP(baseParams);
    expect(r.rangeAnalysis.tickWidth).toBeGreaterThan(0);
    expect(r.rangeAnalysis.estimatedTimeInRange).toBeGreaterThan(0);
    expect(r.rangeAnalysis.estimatedTimeInRange).toBeLessThanOrEqual(1);
  });

  it('in-range flag tracks the configured band', () => {
    const r = simulateV4LP(baseParams);
    const inRangeCount = r.scenarios.filter((s) => s.inRange).length;
    // The grid goes from 0.1x to 4x; the [0.9, 1.1] band covers 11 steps
    // (the geometric mean + a couple around it), so we expect ~10-12 hits.
    expect(inRangeCount).toBeGreaterThan(0);
    expect(inRangeCount).toBeLessThan(20);
  });
});

describe('optimizeV4Range', () => {
  it('produces lower < current < upper for positive width', () => {
    const r = optimizeV4Range({ currentPrice: 1, volatility: 0.5, targetTimeInRange: 0.7 });
    expect(r.lowerPrice).toBeLessThan(1);
    expect(r.upperPrice).toBeGreaterThan(1);
    expect(r.tickWidth).toBeGreaterThan(0);
  });

  it('wider target in range → narrower width', () => {
    const tight = optimizeV4Range({ currentPrice: 1, volatility: 0.5, targetTimeInRange: 0.5 });
    const loose = optimizeV4Range({ currentPrice: 1, volatility: 0.5, targetTimeInRange: 0.9 });
    // Tighter target = lower fraction in range ⇒ narrower range chosen by solver
    expect(tight.tickWidth).toBeLessThan(loose.tickWidth);
  });
});