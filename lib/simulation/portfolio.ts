/**
 * Multi-position portfolio simulator.
 *
 * Aggregates multiple LP positions into a single portfolio with
 * correlated-risk analytics. Each position is simulated with the existing
 * `runBacktest` engine; the portfolio layer is purely glue + analytics:
 *
 *   1. Run `runBacktest` per position.
 *   2. Intersect the resulting timestamp sets so a daily portfolio snapshot
 *      only includes days where every position has data.
 *   3. Sum per-position `lpValue` to get the portfolio's daily total.
 *   4. Compute portfolio-level analytics (annualized return, worst day,
 *      mean inter-position correlation).
 *
 * Design notes
 * ------------
 * - **No rebalancing inside the portfolio layer.** Rebalancing is a
 *   per-position concern handled by `runBacktest`; the portfolio simulator
 *   delegates. Per-position gas / decimals / rebalance mode are filled with
 *   sensible defaults because `PortfolioPosition` does not carry them.
 * - **Pure function, no I/O.** Computes everything inline so it can run
 *   inside a server component or test in isolation.
 * - **Deterministic.** Output depends only on inputs — same numbers across
 *   runs.
 */

import { runBacktest, BacktestParams, PriceDataPoint } from './backtest';
import {
  PortfolioDailyState,
  PortfolioParams,
  PortfolioPosition,
  PortfolioResult,
} from './portfolio-types';

// =============================================================================
// Defaults
// =============================================================================

/**
 * Conservative default per-day volume when a position does not provide one.
 * 1e6 USD/day is roughly the volume of a small/mid pool; enough to produce
 * non-zero fee accrual but not so large it dominates PnL.
 */
const DEFAULT_VOLUME_USD = 1_000_000;

/**
 * Generic token decimals. Most V3 pairs are 18/18 or 18/6; 18/18 is the
 * numerically safe default when `PortfolioPosition` doesn't carry the info.
 */
const DEFAULT_TOKEN_DECIMALS = 18;

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Normalize a `PortfolioPosition.priceHistory` into the engine's
 * `PriceDataPoint` shape, filling missing `volumeUSD` with the default.
 */
function normalizePriceHistory(
  raw: PortfolioPosition['priceHistory'],
): PriceDataPoint[] {
  return raw.map((p) => ({
    timestamp: p.timestamp,
    price: p.price,
    volumeUSD: p.volumeUSD ?? DEFAULT_VOLUME_USD,
  }));
}

/**
 * Build a `BacktestParams` for one position using engine defaults for the
 * fields `PortfolioPosition` doesn't carry (gas, decimals, rebalance mode,
 * deposit token).
 */
function buildBacktestParams(
  position: PortfolioPosition,
  entryTimestamp: number,
): BacktestParams {
  return {
    priceHistory: normalizePriceHistory(position.priceHistory),
    entryTimestamp,
    lowerPrice: position.lowerPrice,
    upperPrice: position.upperPrice,
    depositAmount: position.allocationUSD,
    // Allocation is given in USD — convert to a balanced 50/50 position.
    depositToken: 'usd',
    // The portfolio layer does not rebalance. Per-position rebalancing
    // belongs in `runBacktest` (the caller can swap it in later).
    rebalanceMode: 'none',
    gasCostGwei: 0,
    gasUnitsPerRebalance: 0,
    token0Decimals: DEFAULT_TOKEN_DECIMALS,
    token1Decimals: DEFAULT_TOKEN_DECIMALS,
    feeTier: position.feeTier,
  };
}

/**
 * Run `runBacktest` for one position and return a `timestamp -> lpValue` map
 * for fast lookup when we aggregate.
 */
function simulateOnePosition(
  position: PortfolioPosition,
  entryTimestamp: number,
): Map<number, number> {
  const result = runBacktest(buildBacktestParams(position, entryTimestamp));
  const out = new Map<number, number>();
  for (const point of result.equityCurve) {
    out.set(point.timestamp, point.lpValue);
  }
  return out;
}

/**
 * Return the sorted intersection of all `timestamp` sets. A timestamp is
 * kept only if every position produced a value for it.
 */
function intersectTimestamps(...sets: Set<number>[]): number[] {
  if (sets.length === 0) return [];
  // Iterate the smallest set for performance.
  const sortedBySize = [...sets].sort((a, b) => a.size - b.size);
  const [smallest, ...rest] = sortedBySize;
  if (!smallest) return [];
  const out: number[] = [];
  for (const ts of smallest) {
    let allHave = true;
    for (const s of rest) {
      if (!s.has(ts)) {
        allHave = false;
        break;
      }
    }
    if (allHave) out.push(ts);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Pearson correlation between two equal-length series. Returns 0 when the
 * denominator is zero (one or both series is constant), which is the
 * conventional "undefined correlation → 0" treatment for a portfolio
 * simulator.
 */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i] as number;
    sumY += ys[i] as number;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - meanX;
    const dy = (ys[i] as number) - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (!Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

/**
 * Convert a per-position value series into per-day returns. Returns
 * `values.length - 1` entries. A zero prior-day value contributes 0
 * instead of `+Infinity`/`NaN`.
 */
function dailyReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1] as number;
    const curr = values[i] as number;
    if (prev === 0) {
      out.push(0);
      continue;
    }
    out.push((curr - prev) / prev);
  }
  return out;
}

/**
 * Mean of all off-diagonal entries of an N×N matrix. Returns 0 for N < 2.
 */
function meanOffDiagonal(matrix: number[][]): number {
  const n = matrix.length;
  if (n < 2) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      sum += (matrix[i] as number[])[j] as number;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Simulate a portfolio of LP positions.
 *
 * @throws Error when `positions` is empty, when no entry timestamp can be
 *         determined, or when the positions share zero timestamps.
 */
export function simulatePortfolio(params: PortfolioParams): PortfolioResult {
  if (!params.positions || params.positions.length === 0) {
    throw new Error('simulatePortfolio: positions array must not be empty');
  }

  // Entry timestamp: explicit param > first point of the first position.
  const firstPosition = params.positions[0] as PortfolioPosition;
  const entryTimestamp =
    params.startTimestamp ?? firstPosition.priceHistory[0]?.timestamp;
  if (entryTimestamp === undefined) {
    throw new Error(
      'simulatePortfolio: cannot determine entry timestamp (provide startTimestamp or non-empty priceHistory)',
    );
  }

  // 1. Per-position simulation → Map<ts, lpValue>
  const perPositionMaps = params.positions.map((pos) =>
    simulateOnePosition(pos, entryTimestamp),
  );

  // 2. Intersect timestamps across all positions
  const commonTimestamps = intersectTimestamps(
    ...perPositionMaps.map((m) => new Set(m.keys())),
  );
  if (commonTimestamps.length === 0) {
    throw new Error(
      'simulatePortfolio: positions share no overlapping timestamps',
    );
  }

  // 3. Daily state
  const daily: PortfolioDailyState[] = commonTimestamps.map((ts) => {
    const positionValues = perPositionMaps.map((m) => m.get(ts) ?? 0);
    const totalValueUSD = positionValues.reduce((acc, v) => acc + v, 0);
    return { timestamp: ts, totalValueUSD, positionValues };
  });

  const initial = daily[0] as PortfolioDailyState;
  const final = daily[daily.length - 1] as PortfolioDailyState;

  // 4. Returns
  const totalReturnUSD = final.totalValueUSD - initial.totalValueUSD;
  const totalReturnPct =
    initial.totalValueUSD > 0 ? totalReturnUSD / initial.totalValueUSD : 0;

  // 5. Annualized return
  const days = Math.max(daily.length - 1, 1);
  const annualizedReturnPct =
    Math.pow(1 + totalReturnPct, 365 / days) - 1;

  // 6. Worst single-day loss
  let worstDayLossPct = 0;
  for (let i = 1; i < daily.length; i++) {
    const prev = (daily[i - 1] as PortfolioDailyState).totalValueUSD;
    const curr = (daily[i] as PortfolioDailyState).totalValueUSD;
    if (prev <= 0) continue;
    const change = (curr - prev) / prev;
    if (change < worstDayLossPct) worstDayLossPct = change;
  }

  // 7. Mean inter-position correlation
  let meanInterPositionCorrelation: number | null = null;
  if (params.positions.length >= 2 && daily.length >= 3) {
    // Need ≥ 3 daily states to get ≥ 2 daily returns (Pearson needs n≥2).
    const returnsByPosition = params.positions.map((_, idx) =>
      dailyReturns(daily.map((d) => d.positionValues[idx] as number)),
    );
    const n = returnsByPosition.length;
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        row.push(pearson(returnsByPosition[i] as number[], returnsByPosition[j] as number[]));
      }
      matrix.push(row);
    }
    meanInterPositionCorrelation = meanOffDiagonal(matrix);
  }

  return {
    initial,
    final,
    daily,
    totalReturnUSD,
    totalReturnPct,
    annualizedReturnPct,
    worstDayLossPct,
    meanInterPositionCorrelation,
  };
}
