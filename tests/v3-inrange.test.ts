/**
 * V3 in-range concentrated-liquidity simulator tests.
 *
 * Covers:
 *   1. In-range: stable price, fees accrue, balances shift with price moves.
 *   2. Below range: all token0, no further rebalance.
 *   3. Above range: all token1, no further rebalance.
 *   4. Cross-range exit: token0 ratio changes when price crosses a tick.
 *   5. Single-day snapshot: 30 daily points.
 *   6. Fee accrual only happens when `inRange === true`.
 *   7. `impermanentLossUSD > 0` when final price ≠ entry price (and was in range).
 *
 * The "DeFi Llama ETH/USDC 30-day price path" test uses a SYNTHETIC but
 * realistic ETH price walk: it seeds a deterministic random number generator
 * with a fixed seed and produces 30 daily observations starting from a
 * representative ETH/USDC price. This is deterministic, hermetic, and
 * captures the same statistical properties (mean reversion, daily vol) as
 * real ETH data without hitting the network in CI.
 */

import { describe, it, expect } from 'vitest';

import {
  simulateV3InRange,
  v3AmountsFromLiquidity,
  v3EntryLiquidity,
  type V3DailyState,
  type V3InRangeParams,
  type V3PricePoint,
} from '../lib/simulation/v3-inrange';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mulberry32 — small deterministic PRNG so synthetic paths are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a deterministic, 30-day ETH/USDC-shaped price walk starting at
 * `startPrice`. Each day the price moves by a geometric Brownian step with
 * `dailyVol` (≈2.5% is reasonable for ETH). This mimics the kind of daily
 * path fetched from DeFi Llama + CoinGecko for a real pool-day replay.
 */
function buildEthUsdcPath(
  startPrice: number,
  dailyVol: number,
  seed: number,
  days: number = 30
): V3PricePoint[] {
  const rng = mulberry32(seed);
  const path: V3PricePoint[] = [];
  let price = startPrice;
  // Anchor on a fixed reference timestamp so tests are reproducible.
  const t0 = 1_704_067_200; // 2024-01-01 UTC
  for (let i = 0; i < days; i++) {
    // Box-Muller pair for a normal draw, taking just the first.
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // Log-return step with mild mean reversion (drift ~ 0).
    const logReturn = -0.01 * (price / startPrice - 1) + dailyVol * z;
    price = price * Math.exp(logReturn);
    // Realistic ETH/USDC daily volume band; keep small in tests so fee
    // accrual stays bounded and IL dominates the final comparison.
    const volumeUSD = 25_000_000 + rng() * 15_000_000;
    path.push({
      timestamp: t0 + i * 86_400,
      price,
      volumeUSD,
    });
  }
  return path;
}

/** Constant price history — useful for stable-price tests. */
function flatPriceHistory(
  price: number,
  days: number,
  volumeUSD: number = 1_000_000
): V3PricePoint[] {
  const t0 = 1_700_000_000;
  return Array.from({ length: days }, (_, i) => ({
    timestamp: t0 + i * 86_400,
    price,
    volumeUSD,
  }));
}

// ---------------------------------------------------------------------------
// 1) In-range: stable price, fees accrue, balances shift with price moves
// ---------------------------------------------------------------------------

describe('simulateV3InRange — in-range behavior', () => {
  it('accrues fees and rebalances token balances as price moves within range', () => {
    // Two halves: first half price drifts up, second half drifts back down.
    const points: V3PricePoint[] = [
      { timestamp: 1, price: 2000, volumeUSD: 1_000_000 },
      { timestamp: 2, price: 2050, volumeUSD: 1_000_000 },
      { timestamp: 3, price: 2100, volumeUSD: 1_000_000 },
      { timestamp: 4, price: 2080, volumeUSD: 1_000_000 },
      { timestamp: 5, price: 2020, volumeUSD: 1_000_000 },
    ];

    const result = simulateV3InRange({
      priceHistory: points,
      lowerPrice: 1900,
      upperPrice: 2200,
      feeTier: 30, // 0.30%
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });

    // Every observation is in range.
    expect(result.daily.every((d) => d.inRange)).toBe(true);

    // Fees should have accrued every day (all in-range).
    // Per day: 1_000_000 * 0.003 * 0.001 = 3 USD → 5 days = 15 USD.
    expect(result.totalFeesUSD).toBeCloseTo(15, 6);
    expect(result.final.totalFeesUSD).toBeCloseTo(15, 6);

    // As price rises, the position should sell token0 for token1 → token0 falls
    // and token1 rises. The shift should be visible in the daily path.
    const d0 = result.daily[0];
    const dPeak = result.daily[2]; // price 2100 (highest in range)
    expect(dPeak.token0Amount).toBeLessThan(d0.token0Amount);
    expect(dPeak.token1Amount).toBeGreaterThan(d0.token1Amount);

    // And as price comes back down, token0 should rebuild and token1 fall.
    expect(dPeak.token0Amount).toBeLessThan(result.daily[4].token0Amount);
    expect(dPeak.token1Amount).toBeGreaterThan(result.daily[4].token1Amount);

    // Liquidity is constant across the run.
    expect(result.initial.liquidity).toBeGreaterThan(0);
    expect(result.final.liquidity).toBe(result.initial.liquidity);
  });
});

// ---------------------------------------------------------------------------
// 2) Below range: all token0, no further rebalance
// ---------------------------------------------------------------------------

describe('simulateV3InRange — below-range behavior', () => {
  it('collapses to all token0 and stops rebalancing once below range', () => {
    const lowerPrice = 2000;
    const upperPrice = 2400;
    // Price drops below range on day 1 and stays there.
    const points: V3PricePoint[] = [
      { timestamp: 1, price: 2200, volumeUSD: 1_000_000 }, // in range
      { timestamp: 2, price: 1900, volumeUSD: 1_000_000 }, // below range
      { timestamp: 3, price: 1800, volumeUSD: 1_000_000 }, // further below
      { timestamp: 4, price: 1700, volumeUSD: 1_000_000 }, // further below
    ];

    const result = simulateV3InRange({
      priceHistory: points,
      lowerPrice,
      upperPrice,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });

    // Day 0 in range; days 1..3 below range.
    expect(result.daily[0].inRange).toBe(true);
    expect(result.daily.slice(1).every((d) => !d.inRange)).toBe(true);

    // Once below range: token1 is zero and frozen across the remaining days.
    const belowDays = result.daily.slice(1);
    for (const d of belowDays) {
      expect(d.token1Amount).toBe(0);
    }
    // Token0 amount is constant below range (price isn't moving the formula).
    const expectedToken0 = belowDays[0].token0Amount;
    for (const d of belowDays) {
      expect(d.token0Amount).toBeCloseTo(expectedToken0, 10);
    }

    // No fees accrue while below range — only the day-0 fee should appear.
    // Day 0 fee: 1_000_000 * 0.003 * 0.001 = 3 USD.
    expect(result.totalFeesUSD).toBeCloseTo(3, 6);

    // V3 amount formula sanity-check: below range the amount0 should equal
    // L · (1/√Pa − 1/√Pb), i.e. the max amount of token0 the position can hold.
    const L = result.daily[0].liquidity;
    const sqrtA = Math.sqrt(lowerPrice);
    const sqrtB = Math.sqrt(upperPrice);
    const expected = L * (1 / sqrtA - 1 / sqrtB);
    expect(belowDays[0].token0Amount).toBeCloseTo(expected, 6);
  });
});

// ---------------------------------------------------------------------------
// 3) Above range: all token1, no further rebalance
// ---------------------------------------------------------------------------

describe('simulateV3InRange — above-range behavior', () => {
  it('collapses to all token1 and stops rebalancing once above range', () => {
    const lowerPrice = 1800;
    const upperPrice = 2200;
    const points: V3PricePoint[] = [
      { timestamp: 1, price: 2000, volumeUSD: 1_000_000 }, // in range
      { timestamp: 2, price: 2300, volumeUSD: 1_000_000 }, // above range
      { timestamp: 3, price: 2400, volumeUSD: 1_000_000 }, // further above
      { timestamp: 4, price: 2500, volumeUSD: 1_000_000 }, // further above
    ];

    const result = simulateV3InRange({
      priceHistory: points,
      lowerPrice,
      upperPrice,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });

    expect(result.daily[0].inRange).toBe(true);
    expect(result.daily.slice(1).every((d) => !d.inRange)).toBe(true);

    // Above range: token0 is zero and frozen.
    const aboveDays = result.daily.slice(1);
    for (const d of aboveDays) {
      expect(d.token0Amount).toBe(0);
    }
    // Token1 amount is constant above range.
    const expectedToken1 = aboveDays[0].token1Amount;
    for (const d of aboveDays) {
      expect(d.token1Amount).toBeCloseTo(expectedToken1, 10);
    }

    // Only the in-range day accrues fees.
    expect(result.totalFeesUSD).toBeCloseTo(3, 6);

    // V3 amount formula sanity-check above range.
    const L = result.daily[0].liquidity;
    const sqrtA = Math.sqrt(lowerPrice);
    const sqrtB = Math.sqrt(upperPrice);
    const expected = L * (sqrtB - sqrtA);
    expect(aboveDays[0].token1Amount).toBeCloseTo(expected, 6);
  });
});

// ---------------------------------------------------------------------------
// 4) Cross-range exit: token0 ratio changes when price crosses a tick
// ---------------------------------------------------------------------------

describe('simulateV3InRange — crossing the range', () => {
  it('flips token composition when price exits the band', () => {
    const lowerPrice = 2000;
    const upperPrice = 2400;
    // Sweep across the band: in → up to upper → above range → drop to lower → below range.
    // Daily-state indices map 1:1 to `points` entries.
    const points: V3PricePoint[] = [
      { timestamp: 1, price: 2200, volumeUSD: 0 }, // idx 0: in range
      { timestamp: 2, price: 2400, volumeUSD: 0 }, // idx 1: upper boundary, still in range
      { timestamp: 3, price: 2600, volumeUSD: 0 }, // idx 2: above range → all token1
      { timestamp: 4, price: 2200, volumeUSD: 0 }, // idx 3: back to in range
      { timestamp: 5, price: 2000, volumeUSD: 0 }, // idx 4: lower boundary, still in range
      { timestamp: 6, price: 1800, volumeUSD: 0 }, // idx 5: below range → all token0
    ];

    const result = simulateV3InRange({
      priceHistory: points,
      lowerPrice,
      upperPrice,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });

    // idx 1: upper boundary (P = Pb). The in-range branch fires (P ≤ Pb), so
    // token0 collapses toward 0 (1/√P − 1/√Pb → 0) and token1 is at its max.
    expect(result.daily[1].token0Amount).toBeCloseTo(0, 6);
    expect(result.daily[1].token1Amount).toBeGreaterThan(0);

    // idx 2: above range. token0 fully zero, token1 locked at its max.
    expect(result.daily[2].token0Amount).toBe(0);
    expect(result.daily[2].token1Amount).toBeCloseTo(result.daily[1].token1Amount, 10);

    // idx 4: lower boundary (P = Pa). token1 collapses toward 0 and token0
    // is at its max within the in-range branch.
    expect(result.daily[4].token1Amount).toBeCloseTo(0, 6);
    expect(result.daily[4].token0Amount).toBeGreaterThan(0);

    // idx 5: below range. token1 zero, token0 locked.
    expect(result.daily[5].token1Amount).toBe(0);
    expect(result.daily[5].token0Amount).toBeCloseTo(result.daily[4].token0Amount, 10);

    // Volume is zero across all observations, so fees must be zero.
    expect(result.totalFeesUSD).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5) Single-day snapshot: simulateV3InRange over 30 daily points
// ---------------------------------------------------------------------------

describe('simulateV3InRange — 30-day snapshot', () => {
  it('produces 30 daily states on a synthetic ETH/USDC path and reports days=30', () => {
    const path = buildEthUsdcPath(2000, 0.025, /* seed */ 0xC0FFEE, 30);
    expect(path).toHaveLength(30);

    const result = simulateV3InRange({
      priceHistory: path,
      lowerPrice: 1800,
      upperPrice: 2200,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });

    expect(result.days).toBe(30);
    expect(result.daily).toHaveLength(30);

    // Liquidity is constant across all snapshots.
    const L0 = result.daily[0].liquidity;
    for (const d of result.daily) {
      expect(d.liquidity).toBeCloseTo(L0, 10);
    }

    // Total fees are positive (the path is in-range for at least part of it
    // and every observation carries a non-zero volume).
    expect(result.totalFeesUSD).toBeGreaterThan(0);

    // The first and last entries are populated and consistent.
    expect(result.initial.timestamp).toBe(path[0].timestamp);
    expect(result.final.timestamp).toBe(path[29].timestamp);

    // HODL / LP / IL numbers are all finite and well-defined.
    expect(Number.isFinite(result.lpValueEnd)).toBe(true);
    expect(Number.isFinite(result.hodlValueEnd)).toBe(true);
    expect(Number.isFinite(result.impermanentLossUSD)).toBe(true);
  });

  it('handles an out-of-range entry price without throwing', () => {
    // Entry at 100 (well below the 1800..2200 band).
    const path: V3PricePoint[] = [
      { timestamp: 1, price: 100, volumeUSD: 500_000 },
      { timestamp: 2, price: 150, volumeUSD: 500_000 },
      { timestamp: 3, price: 200, volumeUSD: 500_000 },
    ];
    const result = simulateV3InRange({
      priceHistory: path,
      lowerPrice: 1800,
      upperPrice: 2200,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });
    expect(result.initial.inRange).toBe(false);
    expect(result.initial.token1Amount).toBe(0);
    expect(result.initial.token0Amount).toBeGreaterThan(0);
    // All days stay out of range → no fees accrue.
    expect(result.totalFeesUSD).toBe(0);
  });

  it('handles an above-range entry price without throwing', () => {
    const path: V3PricePoint[] = [
      { timestamp: 1, price: 3000, volumeUSD: 500_000 },
      { timestamp: 2, price: 3200, volumeUSD: 500_000 },
      { timestamp: 3, price: 3400, volumeUSD: 500_000 },
    ];
    const result = simulateV3InRange({
      priceHistory: path,
      lowerPrice: 1800,
      upperPrice: 2200,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });
    expect(result.initial.inRange).toBe(false);
    expect(result.initial.token0Amount).toBe(0);
    expect(result.initial.token1Amount).toBeGreaterThan(0);
    expect(result.totalFeesUSD).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6) Fee accrual only happens when inRange === true
// ---------------------------------------------------------------------------

describe('simulateV3InRange — fee gating', () => {
  it('does not accrue fees when inRange === false, even with non-zero volume', () => {
    // All days out of range.
    const points: V3PricePoint[] = [
      { timestamp: 1, price: 100, volumeUSD: 5_000_000 },
      { timestamp: 2, price: 150, volumeUSD: 5_000_000 },
      { timestamp: 3, price: 200, volumeUSD: 5_000_000 },
    ];

    const result = simulateV3InRange({
      priceHistory: points,
      lowerPrice: 1000,
      upperPrice: 2000,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });

    expect(result.daily.every((d) => !d.inRange)).toBe(true);
    expect(result.totalFeesUSD).toBe(0);
  });

  it('accrues fees on in-range days but skips out-of-range days in the same run', () => {
    const points: V3PricePoint[] = [
      { timestamp: 1, price: 1500, volumeUSD: 2_000_000 }, // in range → fee
      { timestamp: 2, price: 2500, volumeUSD: 2_000_000 }, // above range → no fee
      { timestamp: 3, price: 1500, volumeUSD: 2_000_000 }, // back in range → fee
      { timestamp: 4, price: 500,  volumeUSD: 2_000_000 }, // below range → no fee
    ];

    const result = simulateV3InRange({
      priceHistory: points,
      lowerPrice: 1000,
      upperPrice: 2000,
      feeTier: 30, // 0.30%
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });

    // 2 in-range days × 2_000_000 × 0.003 × 0.001 = 12 USD total.
    expect(result.totalFeesUSD).toBeCloseTo(12, 6);
    // Cumulative fees monotonically increase on in-range days and stay flat otherwise.
    expect(result.daily[0].totalFeesUSD).toBeCloseTo(6, 6);
    expect(result.daily[1].totalFeesUSD).toBeCloseTo(6, 6); // unchanged
    expect(result.daily[2].totalFeesUSD).toBeCloseTo(12, 6);
    expect(result.daily[3].totalFeesUSD).toBeCloseTo(12, 6); // unchanged
  });

  it('zero volume produces zero fees even while in range', () => {
    const result = simulateV3InRange({
      priceHistory: flatPriceHistory(2000, 10, 0),
      lowerPrice: 1900,
      upperPrice: 2100,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });
    expect(result.daily.every((d) => d.inRange)).toBe(true);
    expect(result.totalFeesUSD).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7) impermanentLossUSD > 0 when final price ≠ entry price (and was in range)
// ---------------------------------------------------------------------------

describe('simulateV3InRange — impermanent loss', () => {
  it('reports positive IL when final price moves inside the range', () => {
    // Tight ±5% band so even a 2.5% price move creates visible IL.
    // Volume is small so fee earnings don't swamp the IL signal.
    const points: V3PricePoint[] = [
      { timestamp: 1, price: 2000, volumeUSD: 10_000 },
      { timestamp: 2, price: 2050, volumeUSD: 10_000 },
    ];
    const result = simulateV3InRange({
      priceHistory: points,
      lowerPrice: 1900,
      upperPrice: 2100,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });
    expect(result.initial.inRange).toBe(true);
    expect(result.final.inRange).toBe(true);
    expect(result.impermanentLossUSD).toBeGreaterThan(0);
  });

  it('IL is zero (within FP) when final price equals entry price', () => {
    // All observations at the same price → no rebalance, no IL.
    const result = simulateV3InRange({
      priceHistory: flatPriceHistory(2000, 10, 1_000),
      lowerPrice: 1900,
      upperPrice: 2100,
      feeTier: 30,
      depositAmount: 10_000,
      liquidityShare: 0.001,
    });
    // HODL and LP should be identical aside from fees, which are tiny here.
    // IL = HODL − LP. If LP = HODL + fees, IL is negative (the fees beat HODL).
    // We allow either sign but require |IL| to be at most the fees accrued.
    expect(Math.abs(result.impermanentLossUSD)).toBeLessThanOrEqual(
      result.totalFeesUSD + 1e-6
    );
  });

  it('IL magnitude grows with the price move inside the range', () => {
    const make = (exit: number) =>
      simulateV3InRange({
        priceHistory: [
          { timestamp: 1, price: 2000, volumeUSD: 0 },
          { timestamp: 2, price: exit, volumeUSD: 0 },
        ],
        lowerPrice: 1900,
        upperPrice: 2100,
        feeTier: 30,
        depositAmount: 10_000,
        liquidityShare: 0.001,
      });
    const small = make(2010); // 0.5% move
    const big = make(2090);   // 4.5% move — closer to boundary
    expect(big.impermanentLossUSD).toBeGreaterThan(small.impermanentLossUSD);
    expect(small.impermanentLossUSD).toBeGreaterThan(0);
    expect(big.impermanentLossUSD).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers — pure math sanity checks (v3AmountsFromLiquidity, v3EntryLiquidity)
// ---------------------------------------------------------------------------

describe('v3AmountsFromLiquidity (pure math)', () => {
  const Pa = 1900;
  const Pb = 2100;
  const L = 5000;

  it('matches the closed-form in-range formulas', () => {
    const P = 2000;
    const sqrtP = Math.sqrt(P);
    const sqrtA = Math.sqrt(Pa);
    const sqrtB = Math.sqrt(Pb);
    const expected0 = L * (1 / sqrtP - 1 / sqrtB);
    const expected1 = L * (sqrtP - sqrtA);
    const out = v3AmountsFromLiquidity(L, P, Pa, Pb);
    expect(out.token0Amount).toBeCloseTo(expected0, 10);
    expect(out.token1Amount).toBeCloseTo(expected1, 10);
  });

  it('collapses to all token0 below range', () => {
    const out = v3AmountsFromLiquidity(L, 1500, Pa, Pb);
    const sqrtA = Math.sqrt(Pa);
    const sqrtB = Math.sqrt(Pb);
    expect(out.token0Amount).toBeCloseTo(L * (1 / sqrtA - 1 / sqrtB), 10);
    expect(out.token1Amount).toBe(0);
  });

  it('collapses to all token1 above range', () => {
    const out = v3AmountsFromLiquidity(L, 3000, Pa, Pb);
    const sqrtA = Math.sqrt(Pa);
    const sqrtB = Math.sqrt(Pb);
    expect(out.token0Amount).toBe(0);
    expect(out.token1Amount).toBeCloseTo(L * (sqrtB - sqrtA), 10);
  });

  it('token0 amount goes to 0 at the upper boundary', () => {
    const out = v3AmountsFromLiquidity(L, Pb, Pa, Pb);
    expect(out.token0Amount).toBeCloseTo(0, 10);
    // At the boundary the in-range branch still applies (P ≤ Pb).
    expect(out.token1Amount).toBeGreaterThan(0);
  });

  it('token1 amount goes to 0 at the lower boundary', () => {
    const out = v3AmountsFromLiquidity(L, Pa, Pa, Pb);
    expect(out.token1Amount).toBeCloseTo(0, 10);
    expect(out.token0Amount).toBeGreaterThan(0);
  });
});

describe('v3EntryLiquidity (pure math)', () => {
  it('chooses L = min(L0, L1) for in-range entry and records actual amounts', () => {
    const { liquidity, token0Amount, token1Amount, inRange } = v3EntryLiquidity(
      10_000,
      2000,
      1900,
      2100
    );
    expect(inRange).toBe(true);
    expect(liquidity).toBeGreaterThan(0);
    // Both amounts should be strictly positive when in range.
    expect(token0Amount).toBeGreaterThan(0);
    expect(token1Amount).toBeGreaterThan(0);

    // Verify L back-derives the recorded amounts correctly at the entry price.
    const back = v3AmountsFromLiquidity(liquidity, 2000, 1900, 2100);
    expect(back.token0Amount).toBeCloseTo(token0Amount, 10);
    expect(back.token1Amount).toBeCloseTo(token1Amount, 10);

    // The recorded USD value of the entry position should be ≤ the original
    // deposit (because we picked the binding L).
    const valueUSD = token0Amount * 2000 + token1Amount;
    expect(valueUSD).toBeLessThanOrEqual(10_000 + 1e-6);
  });

  it('all token0 below range, L derived from amount0 formula', () => {
    const { liquidity, token0Amount, token1Amount, inRange } = v3EntryLiquidity(
      10_000,
      1500,
      1900,
      2100
    );
    expect(inRange).toBe(false);
    expect(token1Amount).toBe(0);
    // amount0 = deposit / entry price = 10_000 / 1500 ≈ 6.6667.
    expect(token0Amount).toBeCloseTo(10_000 / 1500, 10);
    // L = amount0 / (1/√Pa − 1/√Pb).
    const sqrtA = Math.sqrt(1900);
    const sqrtB = Math.sqrt(2100);
    expect(liquidity).toBeCloseTo(token0Amount / (1 / sqrtA - 1 / sqrtB), 10);
  });

  it('all token1 above range, L derived from amount1 formula', () => {
    const { liquidity, token0Amount, token1Amount, inRange } = v3EntryLiquidity(
      10_000,
      3000,
      1900,
      2100
    );
    expect(inRange).toBe(false);
    expect(token0Amount).toBe(0);
    expect(token1Amount).toBeCloseTo(10_000, 10);
    // L = amount1 / (√Pb − √Pa).
    const sqrtA = Math.sqrt(1900);
    const sqrtB = Math.sqrt(2100);
    expect(liquidity).toBeCloseTo(token1Amount / (sqrtB - sqrtA), 10);
  });
});

// ---------------------------------------------------------------------------
// Input validation — throws fast on bad inputs
// ---------------------------------------------------------------------------

describe('simulateV3InRange — input validation', () => {
  const valid: V3InRangeParams = {
    priceHistory: flatPriceHistory(2000, 3),
    lowerPrice: 1900,
    upperPrice: 2100,
    feeTier: 30,
  };

  it('throws on empty priceHistory', () => {
    expect(() => simulateV3InRange({ ...valid, priceHistory: [] })).toThrow(
      /priceHistory/
    );
  });

  it('throws when lowerPrice >= upperPrice', () => {
    expect(() =>
      simulateV3InRange({ ...valid, lowerPrice: 2100, upperPrice: 2100 })
    ).toThrow(/lowerPrice/);
  });

  it('throws on non-positive price', () => {
    expect(() =>
      simulateV3InRange({
        ...valid,
        priceHistory: [{ timestamp: 1, price: 0 }],
      })
    ).toThrow(/price/);
  });

  it('throws on negative feeTier', () => {
    expect(() => simulateV3InRange({ ...valid, feeTier: -1 })).toThrow(/feeTier/);
  });
});

// ---------------------------------------------------------------------------
// V3DailyState shape — interface guard
// ---------------------------------------------------------------------------

describe('V3DailyState shape', () => {
  it('every field is present and of the correct type', () => {
    const result = simulateV3InRange({
      priceHistory: flatPriceHistory(2000, 3),
      lowerPrice: 1900,
      upperPrice: 2100,
      feeTier: 30,
    });
    const sample: V3DailyState = result.daily[0];
    expect(typeof sample.timestamp).toBe('number');
    expect(typeof sample.price).toBe('number');
    expect(typeof sample.inRange).toBe('boolean');
    expect(typeof sample.token0Amount).toBe('number');
    expect(typeof sample.token1Amount).toBe('number');
    expect(typeof sample.totalFeesUSD).toBe('number');
    expect(typeof sample.liquidity).toBe('number');
  });
});
