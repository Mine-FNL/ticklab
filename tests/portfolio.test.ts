/**
 * Tests for the multi-position portfolio simulator.
 *
 * Covers:
 *   1. Single-position portfolio equals a bare `runBacktest` (≤ 1e-9 tol)
 *   2. Two-position portfolio with equal allocations = sum of parts
 *   3. Two correlated positions → meanInterPositionCorrelation ≈ 1
 *   4. Two anti-correlated positions → meanInterPositionCorrelation < 0
 *   5. Empty portfolio throws
 *   6. Single-position portfolio → meanInterPositionCorrelation is null
 *   7. Non-aligned timestamps → portfolio uses the intersection
 *   8. Worst-day loss calculation (synthetic data, known crash)
 *   9. Annualized return with a known short-window return
 *
 * Mocking strategy
 * ----------------
 * `runBacktest` is wrapped at the module level with `vi.mock` so each test
 * can install its own stub implementation via `mockRunBacktest`. The wrapped
 * implementation defaults to the real engine, so test 1 (single-position
 * equivalence) exercises the real code path without further setup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PortfolioPosition } from '../lib/simulation/portfolio-types';

vi.mock('../lib/simulation/backtest', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/simulation/backtest')>(
      '../lib/simulation/backtest',
    );
  return {
    ...actual,
    runBacktest: vi.fn(actual.runBacktest),
  };
});

import * as backtestModule from '../lib/simulation/backtest';
const runBacktest = backtestModule.runBacktest as unknown as ReturnType<
  typeof vi.fn
>;

// =============================================================================
// Helpers
// =============================================================================

const DAY = 86_400;

/**
 * Build a flat price history near 1.0 to avoid `lib/univ3/math.ts` edge cases
 * for extreme tick magnitudes that are out of scope here.
 */
function makePriceHistory(
  baseTs: number,
  days: number,
): Array<{ timestamp: number; price: number; volumeUSD: number }> {
  return Array.from({ length: days }, (_, i) => ({
    timestamp: baseTs + i * DAY,
    price: 1.0,
    volumeUSD: 1_000_000,
  }));
}

function makePosition(
  pool: string,
  priceHistory: Array<{ timestamp: number; price: number; volumeUSD: number }>,
  overrides: Partial<PortfolioPosition> = {},
): PortfolioPosition {
  return {
    pool,
    priceHistory,
    lowerPrice: 0.95,
    upperPrice: 1.05,
    feeTier: 30,
    allocationUSD: 1000,
    ...overrides,
  };
}

/**
 * Install a stub `runBacktest` that maps a priceHistory's first timestamp
 * (after portfolio normalization, which preserves the original timestamps)
 * to a specific equity curve.
 */
function stubRunBacktestByFirstTs(
  curveByFirstTs: Map<
    number,
    Array<{ timestamp: number; lpValue: number }>
  >,
) {
  runBacktest.mockImplementation((params: {
    priceHistory: Array<{ timestamp: number }>;
  }) => {
    const curve = curveByFirstTs.get(params.priceHistory[0].timestamp);
    if (!curve) {
      throw new Error(
        `stubRunBacktest: no curve for first-ts ${params.priceHistory[0].timestamp}`,
      );
    }
    return {
      totalReturn: 0,
      hodlReturn: 0,
      excessReturn: 0,
      totalFees: 0,
      realizedIL: 0,
      gasCosts: 0,
      rebalanceCount: 0,
      timeInRange: 1,
      periodsOutOfRange: 0,
      equityCurve: curve,
      drawdowns: [],
      bestWindow: { start: 0, end: 0, return: 0 },
      worstWindow: { start: 0, end: 0, return: 0 },
    };
  });
}

// =============================================================================
// Case 1: single-position portfolio equals runBacktest
// =============================================================================

describe('simulatePortfolio — single position equals runBacktest', () => {
  afterEach(() => {
    runBacktest.mockReset();
  });

  it('returns daily values within 1e-9 of runBacktest.equityCurve.lpValue', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');

    const baseTs = 1_700_000_000;
    const priceHistory = makePriceHistory(baseTs, 30);
    const position = makePosition('ETH/USDC', priceHistory);

    // No per-test stub → falls through to the real engine.
    const single = (await backtestModule.runBacktest({
      priceHistory,
      entryTimestamp: baseTs,
      lowerPrice: position.lowerPrice,
      upperPrice: position.upperPrice,
      depositAmount: position.allocationUSD,
      depositToken: 'usd',
      rebalanceMode: 'none',
      gasCostGwei: 0,
      gasUnitsPerRebalance: 0,
      token0Decimals: 18,
      token1Decimals: 18,
      feeTier: position.feeTier,
    })) as { equityCurve: Array<{ lpValue: number }> };

    const portfolio = simulatePortfolio({ positions: [position] });

    expect(portfolio.daily.length).toBe(single.equityCurve.length);
    for (let i = 0; i < portfolio.daily.length; i++) {
      const got = portfolio.daily[i].positionValues[0];
      const want = single.equityCurve[i].lpValue;
      expect(Math.abs(got - want)).toBeLessThanOrEqual(1e-9);
    }

    const initialLp = single.equityCurve[0].lpValue;
    const finalLp = single.equityCurve[single.equityCurve.length - 1].lpValue;
    expect(Math.abs(portfolio.initial.totalValueUSD - initialLp)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(portfolio.final.totalValueUSD - finalLp)).toBeLessThanOrEqual(1e-9);

    const wantReturnPct = (finalLp - initialLp) / initialLp;
    expect(Math.abs(portfolio.totalReturnPct - wantReturnPct)).toBeLessThanOrEqual(1e-9);

    // No second position → correlation is null
    expect(portfolio.meanInterPositionCorrelation).toBeNull();
  });
});

// =============================================================================
// Cases 2-9: stubbed `runBacktest`
// =============================================================================

describe('simulatePortfolio — multi-position aggregation', () => {
  beforeEach(() => {
    runBacktest.mockReset();
  });
  afterEach(() => {
    runBacktest.mockReset();
  });

  it('equals the sum of each position\'s lpValue when allocations differ', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');

    const baseTs = 1_700_000_000;
    const N = 30;

    const curveA = Array.from({ length: N }, (_, i) => ({
      timestamp: baseTs + i * DAY,
      lpValue: 1000 + i * 10,
    }));
    const curveB = Array.from({ length: N }, (_, i) => ({
      timestamp: baseTs + i * DAY,
      lpValue: 500 + i * 7,
    }));

    const phA = makePriceHistory(baseTs, N);
    const phB = makePriceHistory(baseTs, N);
    stubRunBacktestByFirstTs(
      new Map([
        [baseTs, curveA],
        // Same first-ts would collide; offset B's priceHistory by 1 second
        // so the stub can disambiguate. The portfolio aggregator keeps the
        // intersection of the *equityCurve* timestamps, so the extra
        // 1-second shift doesn't drop any intersection day.
        [baseTs + 1, curveB],
      ]),
    );

    const positionA = makePosition('A', phA);
    const positionB = makePosition(
      'B',
      phB.map((p, i) => (i === 0 ? { ...p, timestamp: p.timestamp + 1 } : p)),
      { allocationUSD: 500 },
    );

    const portfolio = simulatePortfolio({ positions: [positionA, positionB] });

    expect(portfolio.daily.length).toBe(N);
    for (let i = 0; i < N; i++) {
      const expectedTotal = curveA[i].lpValue + curveB[i].lpValue;
      expect(portfolio.daily[i].totalValueUSD).toBeCloseTo(expectedTotal, 9);
      expect(portfolio.daily[i].positionValues[0]).toBeCloseTo(curveA[i].lpValue, 9);
      expect(portfolio.daily[i].positionValues[1]).toBeCloseTo(curveB[i].lpValue, 9);
    }

    expect(portfolio.initial.totalValueUSD).toBeCloseTo(1500, 9);
    expect(portfolio.final.totalValueUSD).toBeCloseTo(1500 + 29 * 17, 9);
    expect(portfolio.totalReturnUSD).toBeCloseTo(29 * 17, 9);
  });

  it('reports ≈ 1.0 mean correlation when both positions follow the same walk', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');

    const baseTs = 1_700_000_000;
    const N = 60;
    const walk = Array.from(
      { length: N },
      (_, i) => 1000 + Math.sin(i * 0.3) * 50 + i * 2,
    );
    const curveA = walk.map((lpValue, i) => ({
      timestamp: baseTs + i * DAY,
      lpValue,
    }));
    const curveB = walk.map((lpValue, i) => ({
      timestamp: baseTs + i * DAY,
      lpValue: lpValue + 100,
    }));

    const phA = makePriceHistory(baseTs, N);
    const phB = makePriceHistory(baseTs, N).map((p, i) =>
      i === 0 ? { ...p, timestamp: p.timestamp + 1 } : p,
    );
    stubRunBacktestByFirstTs(
      new Map([
        [baseTs, curveA],
        [baseTs + 1, curveB],
      ]),
    );

    const portfolio = simulatePortfolio({
      positions: [makePosition('A', phA), makePosition('B', phB)],
    });

    expect(portfolio.meanInterPositionCorrelation).not.toBeNull();
    expect(portfolio.meanInterPositionCorrelation!).toBeGreaterThan(0.999);
  });

  it('reports negative mean correlation when positions move in opposite directions', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');

    const baseTs = 1_700_000_000;
    const N = 60;

    // Build curveA with a noisy walk.
    const curveA: Array<{ timestamp: number; lpValue: number }> = [];
    let vA = 1000;
    const seed = [0.05, -0.03, 0.02, -0.04, 0.06, -0.02, 0.04, -0.01, 0.03, -0.05];
    for (let i = 0; i < N; i++) {
      vA = vA * (1 + (seed[i % seed.length] as number));
      curveA.push({ timestamp: baseTs + i * DAY, lpValue: vA });
    }

    // Build curveB as a strong negative mirror of A (with its own noise).
    const curveB: Array<{ timestamp: number; lpValue: number }> = [];
    let vB = 800;
    for (let i = 0; i < N; i++) {
      const aReturn =
        i === 0 ? 0 : curveA[i].lpValue / curveA[i - 1].lpValue - 1;
      vB =
        vB *
        (1 - aReturn * 0.95 + ((seed[(i + 3) % seed.length] as number) - 0.02));
      curveB.push({ timestamp: baseTs + i * DAY, lpValue: vB });
    }

    const phA = makePriceHistory(baseTs, N);
    const phB = makePriceHistory(baseTs, N).map((p, i) =>
      i === 0 ? { ...p, timestamp: p.timestamp + 1 } : p,
    );
    stubRunBacktestByFirstTs(
      new Map([
        [baseTs, curveA],
        [baseTs + 1, curveB],
      ]),
    );

    const portfolio = simulatePortfolio({
      positions: [makePosition('A', phA), makePosition('B', phB)],
    });

    expect(portfolio.meanInterPositionCorrelation).not.toBeNull();
    expect(portfolio.meanInterPositionCorrelation!).toBeLessThan(-0.5);

    // Diversification benefit: portfolio variance is strictly less than the
    // larger of the two position variances.
    const portfolioReturns = portfolio.daily.slice(1).map(
      (d, i) => d.totalValueUSD / portfolio.daily[i].totalValueUSD - 1,
    );
    const posAReturns = portfolio.daily.slice(1).map(
      (d, i) => d.positionValues[0] / portfolio.daily[i].positionValues[0] - 1,
    );
    const posBReturns = portfolio.daily.slice(1).map(
      (d, i) => d.positionValues[1] / portfolio.daily[i].positionValues[1] - 1,
    );
    const variance = (xs: number[]) => {
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / xs.length;
    };
    const varPortfolio = variance(portfolioReturns);
    const maxComponentVar = Math.max(variance(posAReturns), variance(posBReturns));
    expect(varPortfolio).toBeLessThan(maxComponentVar);
  });

  it('throws on empty positions array', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');
    expect(() => simulatePortfolio({ positions: [] })).toThrow(
      /positions array must not be empty/i,
    );
  });

  it('leaves meanInterPositionCorrelation as null for a single-position portfolio', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');

    const baseTs = 1_700_000_000;
    const N = 30;
    const curve = Array.from({ length: N }, (_, i) => ({
      timestamp: baseTs + i * DAY,
      lpValue: 1000 + i * 5,
    }));
    const ph = makePriceHistory(baseTs, N);
    stubRunBacktestByFirstTs(new Map([[baseTs, curve]]));

    const portfolio = simulatePortfolio({ positions: [makePosition('Only', ph)] });
    expect(portfolio.meanInterPositionCorrelation).toBeNull();
  });

  it('uses the timestamp intersection when positions do not align', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');

    const baseTs = 1_700_000_000;
    const N = 15;
    const A_OFFSET = 0; // A: days 0..14
    const B_OFFSET = 5; // B: days 5..19

    const curveA = Array.from({ length: N }, (_, i) => ({
      timestamp: baseTs + (A_OFFSET + i) * DAY,
      lpValue: 1000 + (A_OFFSET + i) * 10,
    }));
    const curveB = Array.from({ length: N }, (_, i) => ({
      timestamp: baseTs + (B_OFFSET + i) * DAY,
      lpValue: 500 + (B_OFFSET + i) * 7,
    }));

    const phA = Array.from({ length: N }, (_, i) => ({
      timestamp: baseTs + (A_OFFSET + i) * DAY,
      price: 1.0,
      volumeUSD: 1_000_000,
    }));
    const phB = Array.from({ length: N }, (_, i) => ({
      timestamp: baseTs + (B_OFFSET + i) * DAY,
      price: 1.0,
      volumeUSD: 1_000_000,
    }));
    stubRunBacktestByFirstTs(
      new Map([
        [baseTs + A_OFFSET * DAY, curveA],
        // Shift B's priceHistory first-ts by 1 second so the stub can
        // disambiguate without changing the equityCurve intersection.
        [baseTs + B_OFFSET * DAY + 1, curveB],
      ]),
    );
    const positionB: PortfolioPosition = makePosition(
      'B',
      phB.map((p, i) =>
        i === 0 ? { ...p, timestamp: p.timestamp + 1 } : p,
      ),
    );

    const portfolio = simulatePortfolio({
      positions: [makePosition('A', phA), positionB],
    });

    // Expect 10 intersection days: ts = baseTs + {5,6,...,14}*DAY
    const expectedTimestamps = Array.from(
      { length: 10 },
      (_, i) => baseTs + (5 + i) * DAY,
    );
    expect(portfolio.daily.map((d) => d.timestamp)).toEqual(expectedTimestamps);
    expect(portfolio.initial.timestamp).toBe(baseTs + 5 * DAY);
    expect(portfolio.final.timestamp).toBe(baseTs + 14 * DAY);

    const first = portfolio.daily[0];
    expect(first.positionValues[0]).toBeCloseTo(1000 + 5 * 10, 9);
    expect(first.positionValues[1]).toBeCloseTo(500 + 5 * 7, 9);
    expect(first.totalValueUSD).toBeCloseTo(
      first.positionValues[0] + first.positionValues[1],
      9,
    );

    const last = portfolio.daily[portfolio.daily.length - 1];
    expect(last.positionValues[0]).toBeCloseTo(1000 + 14 * 10, 9);
    expect(last.positionValues[1]).toBeCloseTo(500 + 14 * 7, 9);
  });

  it('computes worstDayLossPct correctly for a synthetic crash day', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');

    const baseTs = 1_700_000_000;
    const N = 20;
    // Stable walk at exactly CRASH_FROM, then a sharp drop at CRASH_DAY to
    // CRASH_TO, then recovery.
    const CRASH_DAY = 10;
    const CRASH_FROM = 1000;
    const CRASH_TO = 600;
    const curve = Array.from({ length: N }, (_, i) => {
      const day = i;
      let lpValue: number;
      if (day < CRASH_DAY) {
        lpValue = CRASH_FROM;
      } else if (day === CRASH_DAY) {
        lpValue = CRASH_TO;
      } else {
        lpValue = CRASH_TO + (day - CRASH_DAY) * 3;
      }
      return { timestamp: baseTs + day * DAY, lpValue };
    });

    const ph = makePriceHistory(baseTs, N);
    stubRunBacktestByFirstTs(new Map([[baseTs, curve]]));

    const portfolio = simulatePortfolio({ positions: [makePosition('Crashing', ph)] });

    // Worst day should be the crash day: -40% drop
    expect(portfolio.worstDayLossPct).toBeCloseTo(-0.4, 9);

    // Also confirm it matches an independent scan over `daily`
    let expectedWorst = 0;
    for (let i = 1; i < portfolio.daily.length; i++) {
      const prev = portfolio.daily[i - 1].totalValueUSD;
      const curr = portfolio.daily[i].totalValueUSD;
      const change = (curr - prev) / prev;
      if (change < expectedWorst) expectedWorst = change;
    }
    expect(portfolio.worstDayLossPct).toBeCloseTo(expectedWorst, 12);
  });

  it('computes annualizedReturnPct = (1 + totalReturnPct) ** (365 / days) - 1', async () => {
    const { simulatePortfolio } = await import('../lib/simulation/portfolio');

    const baseTs = 1_700_000_000;
    // 30-day portfolio with a clean linear walk: 1000 → 1100 = +10%
    const N = 31;
    const curve = Array.from({ length: N }, (_, i) => ({
      timestamp: baseTs + i * DAY,
      lpValue: 1000 + (i * 100) / 30,
    }));

    const ph = makePriceHistory(baseTs, N);
    stubRunBacktestByFirstTs(new Map([[baseTs, curve]]));

    const portfolio = simulatePortfolio({ positions: [makePosition('Linear', ph)] });

    const days = portfolio.daily.length - 1;
    const expectedAnnualized =
      Math.pow(1 + portfolio.totalReturnPct, 365 / days) - 1;
    expect(portfolio.annualizedReturnPct).toBeCloseTo(expectedAnnualized, 12);

    // Sanity: +10% over 30 days → annualized ≈ (1.1)^(365/30) - 1
    const knownShortWindow = Math.pow(1.1, 365 / 30) - 1;
    expect(portfolio.annualizedReturnPct).toBeCloseTo(knownShortWindow, 9);
  });
});
