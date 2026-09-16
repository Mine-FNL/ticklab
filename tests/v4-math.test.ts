/**
 * V4 math + hook scoring tests.
 *
 * These exercise the deterministic parts of the V4 simulation engine that
 * do NOT require RPC access. They protect against:
 *   - Fee rate regressions in hook math
 *   - Off-by-one in pool key hashing
 *   - Hook recommendation ranking stability
 */

import { describe, it, expect } from 'vitest';

import {
  calculateEffectiveFeeRate,
  calculateHookAdjustedLPReturn,
  estimateFlowCapture,
  calculateV4OptimalRange,
} from '../lib/univ4/math';
import {
  hashPoolKey,
  sortCurrencies,
} from '../lib/univ4/pool';
import {
  calculateHookLPScore,
  recommendHooks,
  HOOK_REGISTRY,
} from '../lib/univ4/hooks';

describe('calculateEffectiveFeeRate', () => {
  it('returns base rate when no hook adjustment', () => {
    expect(calculateEffectiveFeeRate(3000, 'none', 0)).toBe(0.003);
    expect(calculateEffectiveFeeRate(500, 'none', 9999)).toBe(0.0005);
  });

  it('handles override — hook replaces base fee', () => {
    // 5000 bips = 0.5%
    expect(calculateEffectiveFeeRate(3000, 'override', 5000)).toBeCloseTo(0.005, 10);
  });

  it('handles dynamic — adds to base fee', () => {
    // 3000 bips base (0.3%) + 500 bips dynamic (0.05%) = 0.35%
    expect(calculateEffectiveFeeRate(3000, 'dynamic', 500)).toBeCloseTo(0.0035, 10);
  });

  it('handles share — LP gets less', () => {
    // 3000 bips base (0.3%), hook takes 1000 bips (10%) → 0.27%
    expect(calculateEffectiveFeeRate(3000, 'share', 1000)).toBeCloseTo(0.0027, 10);
  });

  it('handles rebate — LP gets more', () => {
    // 3000 bips base (0.3%), rebate 1000 bips (10%) → 0.33%
    expect(calculateEffectiveFeeRate(3000, 'rebate', 1000)).toBeCloseTo(0.0033, 10);
  });

  it('clamps share to non-negative', () => {
    // 30_000 bips share would imply negative rate; clamp to 0
    const r = calculateEffectiveFeeRate(3000, 'share', 30000);
    expect(r).toBe(0);
  });
});

describe('calculateHookAdjustedLPReturn', () => {
  it('returns zero or negative net fees for tiny volume', () => {
    const r = calculateHookAdjustedLPReturn({
      volume24h: 0,
      baseFeeTier: 3000,
      yourLiquidity: 1000n,
      poolLiquidity: 1_000_000n,
      timeInRange: 1,
      horizonDays: 1,
      hookFeeType: 'none',
      hookFeeBips: 0,
      hookGasOverhead: 0,
      estimatedSwapsPerDay: 0,
    });
    expect(r.grossFeesUSD).toBe(0);
    expect(r.netFeesUSD).toBe(0);
  });

  it('produces positive net fees for healthy volume, no hooks', () => {
    const r = calculateHookAdjustedLPReturn({
      volume24h: 10_000_000,
      baseFeeTier: 3000,
      yourLiquidity: 1000n,
      poolLiquidity: 1_000_000n,
      timeInRange: 0.9,
      horizonDays: 30,
      hookFeeType: 'none',
      hookFeeBips: 0,
      hookGasOverhead: 0,
      estimatedSwapsPerDay: 100,
    });
    expect(r.grossFeesUSD).toBeGreaterThan(0);
    expect(r.netFeesUSD).toBeGreaterThan(0);
  });

  it('share hook reduces net fees vs none', () => {
    const base = calculateHookAdjustedLPReturn({
      volume24h: 10_000_000,
      baseFeeTier: 3000,
      yourLiquidity: 1000n,
      poolLiquidity: 1_000_000n,
      timeInRange: 0.9,
      horizonDays: 30,
      hookFeeType: 'none',
      hookFeeBips: 0,
      hookGasOverhead: 0,
      estimatedSwapsPerDay: 100,
    });
    const shared = calculateHookAdjustedLPReturn({
      ...({
        volume24h: 10_000_000,
        baseFeeTier: 3000,
        yourLiquidity: 1000n,
        poolLiquidity: 1_000_000n,
        timeInRange: 0.9,
        horizonDays: 30,
        hookFeeType: 'none',
        hookFeeBips: 0,
        hookGasOverhead: 0,
        estimatedSwapsPerDay: 100,
      } as const),
      hookFeeType: 'share',
      hookFeeBips: 1000, // 10%
    });
    expect(shared.netFeesUSD).toBeLessThan(base.netFeesUSD);
    expect(shared.hookShareUSD).toBeGreaterThan(0);
  });
});

describe('estimateFlowCapture', () => {
  it('is monotonic in volume, ratio, timeInRange, multiplier', () => {
    const baseline = estimateFlowCapture(1000, 0.01, 0.5, 1.0);
    expect(estimateFlowCapture(2000, 0.01, 0.5, 1.0)).toBeCloseTo(baseline * 2, 6);
    expect(estimateFlowCapture(1000, 0.02, 0.5, 1.0)).toBeCloseTo(baseline * 2, 6);
    expect(estimateFlowCapture(1000, 0.01, 1.0, 1.0)).toBeCloseTo(baseline * 2, 6);
    expect(estimateFlowCapture(1000, 0.01, 0.5, 2.0)).toBeCloseTo(baseline * 2, 6);
  });
});

describe('calculateV4OptimalRange', () => {
  it('expands with higher volatility for the same confidence', () => {
    const tight = calculateV4OptimalRange(1, 0.3, 0.95);
    const wide = calculateV4OptimalRange(1, 1.0, 0.95);
    expect(wide.lowerPrice).toBeLessThan(tight.lowerPrice);
    expect(wide.upperPrice).toBeGreaterThan(tight.upperPrice);
    expect(wide.tickWidth).toBeGreaterThan(tight.tickWidth);
  });

  it('expands with higher confidence for the same volatility', () => {
    const c95 = calculateV4OptimalRange(1, 0.6, 0.95);
    const c99 = calculateV4OptimalRange(1, 0.6, 0.99);
    expect(c99.tickWidth).toBeGreaterThan(c95.tickWidth);
  });

  it('tick width is a positive multiple of tickSpacing', () => {
    const r = calculateV4OptimalRange(1, 0.5, 0.95, 60);
    expect(r.tickWidth % 60).toBe(0);
    expect(r.tickWidth).toBeGreaterThan(0);
  });
});

describe('hashPoolKey + sortCurrencies', () => {
  const a = '0x1111111111111111111111111111111111111111';
  const b = '0x2222222222222222222222222222222222222222';

  it('sortCurrencies orders by lower address first', () => {
    expect(sortCurrencies(b, a)).toEqual([a.toLowerCase(), b.toLowerCase()]);
    expect(sortCurrencies(a, b)).toEqual([a.toLowerCase(), b.toLowerCase()]);
  });

  it('hashPoolKey produces a 32-byte hex string', () => {
    const h = hashPoolKey({
      currency0: a.toLowerCase(),
      currency1: b.toLowerCase(),
      fee: 3000,
      tickSpacing: 60,
      hooks: '0x0000000000000000000000000000000000000000',
    });
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('hashPoolKey is order-sensitive on currency0/currency1 (not sorted)', () => {
    const h1 = hashPoolKey({
      currency0: a.toLowerCase(),
      currency1: b.toLowerCase(),
      fee: 3000,
      tickSpacing: 60,
      hooks: '0x0000000000000000000000000000000000000000',
    });
    const h2 = hashPoolKey({
      currency0: b.toLowerCase(),
      currency1: a.toLowerCase(),
      fee: 3000,
      tickSpacing: 60,
      hooks: '0x0000000000000000000000000000000000000000',
    });
    expect(h1).not.toBe(h2);
  });

  it('hashPoolKey changes with fee / tickSpacing / hooks', () => {
    const base = {
      currency0: a.toLowerCase(),
      currency1: b.toLowerCase(),
      fee: 3000 as number,
      tickSpacing: 60 as number,
      hooks: '0x0000000000000000000000000000000000000000',
    };
    const h0 = hashPoolKey(base);
    expect(hashPoolKey({ ...base, fee: 500 })).not.toBe(h0);
    expect(hashPoolKey({ ...base, tickSpacing: 10 })).not.toBe(h0);
    expect(
      hashPoolKey({
        ...base,
        hooks: '0x3333333333333333333333333333333333333333',
      })
    ).not.toBe(h0);
  });
});

describe('calculateHookLPScore', () => {
  it('returns the base APR for unknown hooks', () => {
    const s = calculateHookLPScore({
      baseAPR: 0.1,
      hookId: 'not_a_real_hook',
      pairVolatility: 0.5,
      estimatedDailySwaps: 50,
    });
    expect(s.netAPR).toBe(0.1);
    expect(s.riskScore).toBe(50);
  });

  it('score risk decreases for audited hooks vs unaudited', () => {
    const auditedHook = Object.entries(HOOK_REGISTRY).find(
      ([, h]) => h.behaviors.auditStatus === 'audited'
    );
    const unauditedHook = Object.entries(HOOK_REGISTRY).find(
      ([, h]) => h.behaviors.auditStatus === 'unaudited'
    );
    if (!auditedHook || !unauditedHook) {
      // Skip silently if registry doesn't have both classes
      return;
    }
    const audited = calculateHookLPScore({
      baseAPR: 0.1,
      hookId: auditedHook[0],
      pairVolatility: 0.5,
      estimatedDailySwaps: 50,
    });
    const unaudited = calculateHookLPScore({
      baseAPR: 0.1,
      hookId: unauditedHook[0],
      pairVolatility: 0.5,
      estimatedDailySwaps: 50,
    });
    expect(audited.riskScore).toBeLessThan(unaudited.riskScore);
  });

  it('recommends top N hooks sorted by netAPR desc', () => {
    const recs = recommendHooks({
      pairSymbol: 'ETH/USDC',
      volatility: 0.6,
      baseAPR: 0.2,
      chainId: 1,
      riskTolerance: 'high',
      timeHorizonDays: 30,
    });
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score.netAPR).toBeGreaterThanOrEqual(recs[i].score.netAPR);
    }
  });

  it('respects risk tolerance filter', () => {
    const low = recommendHooks({
      pairSymbol: 'ETH/USDC',
      volatility: 0.6,
      baseAPR: 0.2,
      chainId: 1,
      riskTolerance: 'low',
      timeHorizonDays: 30,
    });
    const high = recommendHooks({
      pairSymbol: 'ETH/USDC',
      volatility: 0.6,
      baseAPR: 0.2,
      chainId: 1,
      riskTolerance: 'high',
      timeHorizonDays: 30,
    });
    expect(low.length).toBeLessThanOrEqual(high.length);
    for (const r of low) {
      expect(r.score.riskScore).toBeLessThanOrEqual(50);
    }
  });
});