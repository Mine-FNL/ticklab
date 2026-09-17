/**
 * V3 In-Range Concentrated-Liquidity Simulator
 *
 * Day-by-day simulator for a single Uniswap V3 LP position. Unlike
 * `lib/simulation/backtest.ts` (which keeps entry amounts fixed across the
 * run), this module rebalances token0 / token1 balances on every step using
 * the closed-form V3 amount formulas:
 *
 *   In range   (Pa ≤ P ≤ Pb):
 *     amount0 = L · ( 1/√P  − 1/√Pb )
 *     amount1 = L · ( √P   − √Pa )
 *
 *   Below range (P < Pa)  — fully token0:
 *     amount0 = L · ( 1/√Pa − 1/√Pb )
 *     amount1 = 0
 *
 *   Above range (P > Pb)  — fully token1:
 *     amount0 = 0
 *     amount1 = L · ( √Pb − √Pa )
 *
 * Liquidity L is constant for the lifetime of the position; it is fixed at
 * entry. Fees accrue each day as `volumeUSD · feeTier/10000 · liquidityShare`
 * when `inRange === true` (no fees when out of range — matches V3 reality).
 *
 * Entry math:
 *   amount0_init = depositAmount / (2 · entryPrice)        (token0 units)
 *   amount1_init = depositAmount / 2                       (token1 USD-equivalent)
 *   L0 = amount0_init / (1/√P − 1/√Pb)
 *   L1 = amount1_init / (√P − √Pa)
 *   L  = min(L0, L1)
 *
 *   We pick `L = min(L0, L1)` (the binding constraint) so the position uses
 *   only what the deposit can actually back. The "unused" side sits idle —
 *   it is NOT modelled as part of the position. The initial `token0Amount`
 *   and `token1Amount` recorded in the daily state are derived from this
 *   chosen L (i.e. the actual amounts backing the position), not from the
 *   raw 50/50 split. HODL uses these same actual entry amounts, which means
 *   IL is computed against the deployed capital only — this matches how a
 *   real LP would compute their position's performance.
 *
 *   Note: this differs from picking `L = L0` or `L = L1` blindly. Either of
 *   those would yield a position requiring more of the other token than the
 *   deposit covers, which is impossible.
 *
 * @module simulation/v3-inrange
 */

/** Single price observation in the input history. */
export interface V3PricePoint {
  /** Unix timestamp (seconds). */
  timestamp: number;
  /** token1 per token0 price at this observation. */
  price: number;
  /** Pool volume over this period in USD (used for fee accrual). */
  volumeUSD?: number;
}

/** Inputs to {@link simulateV3InRange}. */
export interface V3InRangeParams {
  /** Daily price + volume path. Order is preserved (chronological). */
  priceHistory: V3PricePoint[];
  /** Lower price bound of the V3 range. */
  lowerPrice: number;
  /** Upper price bound of the V3 range. */
  upperPrice: number;
  /**
   * V3 fee tier in ENGINE format: `feeTier / 100` gives the fee as a decimal.
   * e.g. `30` = 0.30% tier, `5` = 0.05% tier, `1` = 0.01% tier.
   * This matches the format used elsewhere in the codebase (and is the
   * integer-tier / 100 convention documented for the strategy engine).
   */
  feeTier: number;
  /**
   * Share of pool fees captured, as a fraction. Default `0.001` (0.1%),
   * which is a typical assumption for a small LP (`$10k` into a `$10M` pool).
   * Mirrors the default used in `lib/simulation/backtest.ts`.
   */
  liquidityShare?: number;
  /**
   * Deposit amount in USD used for share-of-pool math. Default `10_000`.
   * Only affects the implied share-of-pool fee accrual; it does not change
   * the shape of the position or the IL computation.
   */
  depositAmount?: number;
}

/** Per-day snapshot of the simulated position. */
export interface V3DailyState {
  timestamp: number;
  price: number;
  inRange: boolean;
  /**
   * Token0 units backing the position on this day. Updates as price moves
   * (in range) or freezes (out of range).
   */
  token0Amount: number;
  /** Token1 units backing the position on this day. */
  token1Amount: number;
  /** Cumulative fees accrued in USD up to and including this day. */
  totalFeesUSD: number;
  /** Liquidity L — constant for the lifetime of the position. */
  liquidity: number;
}

/** Final result returned by {@link simulateV3InRange}. */
export interface V3InRangeResult {
  /** State at the first (entry) observation. */
  initial: V3DailyState;
  /** State at the last observation. */
  final: V3DailyState;
  /** Full daily path (entry day included). */
  daily: V3DailyState[];
  /** Total fees earned over the run (USD). */
  totalFeesUSD: number;
  /** Final LP value in USD (positions + accumulated fees). */
  lpValueEnd: number;
  /**
   * Final HODL value in USD (entry position value re-priced at exit).
   * Uses the actual entry amounts that back the position.
   */
  hodlValueEnd: number;
  /**
   * `HODL − LP` at exit (USD). Positive ⇒ LP underperformed HODL, i.e. the
   * position suffered impermanent loss. Can be negative if fees earned
   * outweigh the divergence loss.
   */
  impermanentLossUSD: number;
  /** Number of days simulated (length of `daily`). */
  days: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Sentinel for "no daily fee accrual" — kept as a constant for clarity. */
const ZERO_FEES = 0;

/** Default liquidity share (0.1%) if caller does not specify one. */
const DEFAULT_LIQUIDITY_SHARE = 0.001;

/** Default deposit amount for share-of-pool fee scaling. */
const DEFAULT_DEPOSIT = 10_000;

/**
 * Compute the (token0, token1) amounts backing liquidity `L` at price `P`,
 * with the V3 range bounded by `Pa` and `Pb`.
 *
 * Uses the closed-form V3 formulas. Caller is responsible for ensuring
 * `Pa < Pb` and `P > 0`.
 */
export function v3AmountsFromLiquidity(
  L: number,
  P: number,
  Pa: number,
  Pb: number
): { token0Amount: number; token1Amount: number } {
  const sqrtP = Math.sqrt(P);
  const sqrtA = Math.sqrt(Pa);
  const sqrtB = Math.sqrt(Pb);

  if (P < Pa) {
    // Below range: fully token0, no token1.
    return {
      token0Amount: L * (1 / sqrtA - 1 / sqrtB),
      token1Amount: 0,
    };
  }
  if (P > Pb) {
    // Above range: fully token1, no token0.
    return {
      token0Amount: 0,
      token1Amount: L * (sqrtB - sqrtA),
    };
  }
  // In range: mixed token0 / token1 composition.
  return {
    token0Amount: L * (1 / sqrtP - 1 / sqrtB),
    token1Amount: L * (sqrtP - sqrtA),
  };
}

/**
 * Compute the constant liquidity `L` from a 50/50 USD deposit at entry price.
 *
 * Splits the deposit 50/50 by USD value at the entry price, derives two
 * candidate liquidity values (one from each side), and picks the binding
 * `min(L0, L1)` so the position fits the deposit. The returned `L` is the
 * constant liquidity used throughout the simulation; the returned token
 * amounts are the ACTUAL amounts backing `L` (which may be slightly less
 * than the raw 50/50 split — the remainder sits idle in the LP's pocket
 * and is not modelled).
 *
 * Handles three cases:
 *   - Entry price below range  → fully token0, `L = amount0 / (1/√Pa − 1/√Pb)`
 *   - Entry price above range  → fully token1, `L = amount1 / (√Pb − √Pa)`
 *   - Entry price inside range → mixed, `L = min(L0, L1)`
 */
export function v3EntryLiquidity(
  depositUSD: number,
  entryPrice: number,
  lowerPrice: number,
  upperPrice: number
): {
  liquidity: number;
  token0Amount: number;
  token1Amount: number;
  /** True iff the entry price falls strictly within `[Pa, Pb]`. */
  inRange: boolean;
} {
  const sqrtA = Math.sqrt(lowerPrice);
  const sqrtB = Math.sqrt(upperPrice);

  if (entryPrice < lowerPrice) {
    // Entry below range — entire deposit converts to token0.
    const token0Amount = depositUSD / entryPrice;
    const liquidity = token0Amount / (1 / sqrtA - 1 / sqrtB);
    return { liquidity, token0Amount, token1Amount: 0, inRange: false };
  }
  if (entryPrice > upperPrice) {
    // Entry above range — entire deposit is token1.
    const token1Amount = depositUSD;
    const liquidity = token1Amount / (sqrtB - sqrtA);
    return { liquidity, token0Amount: 0, token1Amount, inRange: false };
  }

  // In range: 50/50 USD split, then derive L from the binding side.
  // NOTE: This convention treats `entryPrice` as `token0` USD price, with
  // token1 priced at $1. That matches the harness's convention for stable-
  // base pairs (USDC/WETH etc.) but is NOT general. The simulator will
  // misbehave for pairs where neither side is roughly pegged to $1.
  const amount0Init = depositUSD / (2 * entryPrice);
  const amount1Init = depositUSD / 2;

  const sqrtP = Math.sqrt(entryPrice);
  const L0 = amount0Init / (1 / sqrtP - 1 / sqrtB); // liquidity implied by amount0
  const L1 = amount1Init / (sqrtP - sqrtA);          // liquidity implied by amount1

  // Pick the binding constraint (whichever L is smaller). This guarantees
  // the position fits within the deposit.
  const liquidity = Math.min(L0, L1);

  // Derive the actual amounts backing `L`. These are the values recorded in
  // the entry state and used for HODL comparisons downstream.
  const { token0Amount, token1Amount } = v3AmountsFromLiquidity(
    liquidity,
    entryPrice,
    lowerPrice,
    upperPrice
  );

  return { liquidity, token0Amount, token1Amount, inRange: true };
}

// ---------------------------------------------------------------------------
// Main simulator
// ---------------------------------------------------------------------------

/**
 * Run a day-by-day V3 in-range simulation over the supplied price path.
 *
 * Liquidity `L` is fixed at entry (no mid-life redeposits or rebalances).
 * On each day the simulator:
 *   1. Reads the new price.
 *   2. Computes the live `token0Amount` / `token1Amount` from `L` and the
 *      current price using {@link v3AmountsFromLiquidity}.
 *   3. Accrues fees only when `inRange === true`.
 *   4. Records the daily state.
 *
 * @throws RangeError when `priceHistory` is empty, when `lowerPrice ≥ upperPrice`,
 *         or when the entry price is non-positive.
 */
export function simulateV3InRange(params: V3InRangeParams): V3InRangeResult {
  const {
    priceHistory,
    lowerPrice,
    upperPrice,
    feeTier,
    liquidityShare = DEFAULT_LIQUIDITY_SHARE,
    depositAmount = DEFAULT_DEPOSIT,
  } = params;

  // --- Validation ---------------------------------------------------------
  if (priceHistory.length === 0) {
    throw new RangeError('simulateV3InRange: priceHistory must not be empty');
  }
  if (!(lowerPrice > 0) || !(upperPrice > 0)) {
    throw new RangeError(
      `simulateV3InRange: bounds must be positive (got lower=${lowerPrice}, upper=${upperPrice})`
    );
  }
  if (!(lowerPrice < upperPrice)) {
    throw new RangeError(
      `simulateV3InRange: lowerPrice must be < upperPrice (got ${lowerPrice}, ${upperPrice})`
    );
  }
  if (!Number.isFinite(feeTier) || feeTier < 0) {
    throw new RangeError(
      `simulateV3InRange: feeTier must be a non-negative finite number (got ${feeTier})`
    );
  }
  if (!(liquidityShare > 0)) {
    throw new RangeError(
      `simulateV3InRange: liquidityShare must be > 0 (got ${liquidityShare})`
    );
  }
  if (!(depositAmount > 0)) {
    throw new RangeError(
      `simulateV3InRange: depositAmount must be > 0 (got ${depositAmount})`
    );
  }

  const first = priceHistory[0];
  if (!(first.price > 0)) {
    throw new RangeError(
      `simulateV3InRange: entry price must be > 0 (got ${first.price})`
    );
  }

  // --- Setup --------------------------------------------------------------
  const feeRate = feeTier / 10000; // engine format → decimal
  const entry = v3EntryLiquidity(depositAmount, first.price, lowerPrice, upperPrice);

  let cumulativeFees = ZERO_FEES;

  const daily: V3DailyState[] = [];

  for (let i = 0; i < priceHistory.length; i++) {
    const point = priceHistory[i];
    const price = point.price;
    const inRange = price >= lowerPrice && price <= upperPrice;

    // 1) Compute live token balances from L and the new price.
    const { token0Amount, token1Amount } = v3AmountsFromLiquidity(
      entry.liquidity,
      price,
      lowerPrice,
      upperPrice
    );

    // 2) Accrue fees only while in range.
    if (inRange) {
      const volume = point.volumeUSD ?? 0;
      if (volume > 0) {
        cumulativeFees += volume * feeRate * liquidityShare;
      }
    }

    daily.push({
      timestamp: point.timestamp,
      price,
      inRange,
      token0Amount,
      token1Amount,
      totalFeesUSD: cumulativeFees,
      liquidity: entry.liquidity,
    });
  }

  // --- Final aggregation --------------------------------------------------
  const initial = daily[0];
  const final = daily[daily.length - 1];

  // Position value at exit = token balances re-priced at exit price + fees.
  // (Fees are tracked in USD and added directly.)
  // NB: this still uses the simulator's stable-base convention (token0
  // valued at $1, token1 valued at exit price). See v3EntryLiquidity's
  // NOTE block.
  const lpValueEnd = final.token0Amount * final.price + final.token1Amount + final.totalFeesUSD;

  // HODL = entry position re-priced at exit price (no fees).
  const hodlValueEnd = initial.token0Amount * final.price + initial.token1Amount;

  const impermanentLossUSD = hodlValueEnd - lpValueEnd;

  return {
    initial,
    final,
    daily,
    totalFeesUSD: final.totalFeesUSD,
    lpValueEnd,
    hodlValueEnd,
    impermanentLossUSD,
    days: daily.length,
  };
}
