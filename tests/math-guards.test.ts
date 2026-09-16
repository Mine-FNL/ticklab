/**
 * Regression tests for divide-by-zero guards added in lib/univ3/math.ts
 * and lib/univ3/position.ts after a smoke test caught them in production.
 *
 * Before the fix, a backtest with a tight tick range (e.g. 190000..210000)
 * where the synthetic price path sits far outside the range produced an
 * opaque `"Division by zero"` 500 from the legacy route. After the fix, the
 * math layer returns 0n on degenerate inputs, the position layer throws a
 * clear message, and the route catches both with a 4xx envelope.
 */

import { describe, it, expect } from 'vitest';
import {
  getAmount0ForLiquidity,
  getAmount1ForLiquidity,
  getLiquidityForAmount0,
  getLiquidityForAmount1,
  tickToSqrtPriceX96,
} from '../lib/univ3/math';
import { calculateBalancedEntry } from '../lib/univ3/position';

// Mirror the private MIN_TICK/MAX_TICK in lib/univ3/math.ts so we can drive
// the regression tests at the real bounds without exporting the constants.
const MIN_TICK = -887272;
const MAX_TICK = 887272;

describe('math layer divide-by-zero guards', () => {
  it('getAmount0ForLiquidity returns 0n when sqrtA is zero (degenerate bounds)', () => {
    expect(getAmount0ForLiquidity(0n, 1n << 128n, 1000n)).toBe(0n);
  });

  it('getAmount0ForLiquidity returns 0n when sqrtB equals sqrtA (zero-width range)', () => {
    const s = tickToSqrtPriceX96(1000);
    expect(getAmount0ForLiquidity(s, s, 1000n)).toBe(0n);
  });

  it('getAmount1ForLiquidity returns 0n on degenerate bounds', () => {
    const s = tickToSqrtPriceX96(50000);
    expect(getAmount1ForLiquidity(s, s, 1000n)).toBe(0n);
    expect(getAmount1ForLiquidity(0n, s, 1000n)).toBe(0n);
  });

  it('getLiquidityForAmount0 returns 0n on degenerate range', () => {
    const s = tickToSqrtPriceX96(50000);
    expect(getLiquidityForAmount0(s, s, 1_000_000n)).toBe(0n);
  });

  it('getLiquidityForAmount1 returns 0n on degenerate range', () => {
    const s = tickToSqrtPriceX96(50000);
    expect(getLiquidityForAmount1(s, s, 1_000_000n)).toBe(0n);
  });

  it('non-degenerate inputs at moderate bounds produce non-zero results', () => {
    // Use a tight but well-conditioned tick range. (Full MIN_TICK..MAX_TICK
    // range yields liquidity values that round to 0n because the ratio is
    // extreme — that is a correct result, not a bug.)
    const a = tickToSqrtPriceX96(-100);
    const b = tickToSqrtPriceX96(100);
    expect(getAmount0ForLiquidity(a, b, 1n << 64n) > 0n).toBe(true);
    expect(getAmount1ForLiquidity(a, b, 1n << 64n) > 0n).toBe(true);
    expect(getLiquidityForAmount0(a, b, 1_000_000n) > 0n).toBe(true);
    expect(getLiquidityForAmount1(a, b, 1_000_000n) > 0n).toBe(true);
  });

  it('tickToSqrtPriceX96 no longer crashes at the bounds (regression for the smoke-test bug)', () => {
    // Before the fix, calling with the maximum tick threw "Division by zero"
    // from the Q256/ratio step. After the fix, it returns a finite bigint.
    expect(() => tickToSqrtPriceX96(MAX_TICK)).not.toThrow();
    expect(() => tickToSqrtPriceX96(MIN_TICK)).not.toThrow();
    expect(() => tickToSqrtPriceX96(MAX_TICK - 1000)).not.toThrow();
    expect(() => tickToSqrtPriceX96(MIN_TICK + 1000)).not.toThrow();
  });
});

describe('position layer divide-by-zero guards', () => {
  it('throws on zero or negative currentPrice', () => {
    expect(() =>
      calculateBalancedEntry(1000, 0, 1.0, 2.0, 18, 6),
    ).toThrow(/currentPrice must be > 0/);
  });

  it('throws on NaN currentPrice (defensive)', () => {
    expect(() =>
      calculateBalancedEntry(1000, NaN, 1.0, 2.0, 18, 6),
    ).toThrow(/Degenerate range|currentPrice/);
  });

  it('produces a valid result on the happy path', () => {
    const r = calculateBalancedEntry(10_000, 1.5, 1.0, 2.0, 18, 6);
    expect(r.token0Amount).toBeGreaterThan(0);
    expect(r.token1Amount).toBeGreaterThan(0);
    expect(r.valueUSD).toBe(10_000);
  });

  it('does not crash on the smoke-test bug scenario (extreme tick bounds + tight range)', () => {
    // Regression for the original bug: lowerTick=190000, upperTick=210000
    // against a pool whose current price (~1) sits far outside. Pre-fix this
    // threw RangeError. Post-fix it returns either a valid position or a
    // clear message.
    expect(() =>
      calculateBalancedEntry(10_000, 1.0, 1.0001 ** 190000, 1.0001 ** 210000, 18, 6),
    ).not.toThrow();
  });
});