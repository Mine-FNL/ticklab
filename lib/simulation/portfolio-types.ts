/**
 * Multi-position portfolio simulator types.
 *
 * Aggregates multiple LP positions (each simulated by `runBacktest`) into a
 * single portfolio with correlated-risk analytics. Designed to be the
 * decision layer above single-position backtests: how to allocate capital
 * across pools, what the portfolio's total risk profile is, etc.
 */

/**
 * One LP position inside a portfolio.
 *
 * `priceHistory` is intentionally typed as a lightweight record instead of
 * the engine's `PriceDataPoint`, so a portfolio can be assembled without
 * importing the backtest engine just to construct inputs.
 */
export interface PortfolioPosition {
  /** Human-readable label for the pool (e.g. "ETH/USDC 0.3%"). */
  pool: string;

  /**
   * Per-day price + volume history for this pool. `volumeUSD` is optional;
   * when omitted we use a conservative default in `simulatePortfolio`.
   */
  priceHistory: Array<{
    /** Unix timestamp (seconds). */
    timestamp: number;
    /** Price (token1 per token0). */
    price: number;
    /** Daily volume in USD; defaults applied when missing. */
    volumeUSD?: number;
  }>;

  /** Lower price bound for the LP range. */
  lowerPrice: number;

  /** Upper price bound for the LP range. */
  upperPrice: number;

  /**
   * Fee tier in the V3 engine's internal format: `30` = 0.3% pool.
   * This matches `BacktestParams.feeTier` (i.e. NOT the on-chain uint24).
   */
  feeTier: number;

  /** How much capital is allocated to this position, in USD. */
  allocationUSD: number;
}

/**
 * Parameters for `simulatePortfolio`.
 */
export interface PortfolioParams {
  /** Positions that make up the portfolio. Must contain ≥ 1 entry. */
  positions: PortfolioPosition[];

  /**
   * Optional entry timestamp used to align all positions. If omitted, the
   * first timestamp in the first position's `priceHistory` is used.
   */
  startTimestamp?: number;
}

/**
 * One day's portfolio snapshot.
 */
export interface PortfolioDailyState {
  /** Unix timestamp (seconds). */
  timestamp: number;

  /** Sum of every position's `lpValue` at this day. */
  totalValueUSD: number;

  /**
   * Per-position `lpValue` at this day. Order matches `PortfolioParams.positions`.
   */
  positionValues: number[];
}

/**
 * Aggregate portfolio result over the backtest window.
 */
export interface PortfolioResult {
  /** Snapshot at the entry day (first aligned timestamp). */
  initial: PortfolioDailyState;

  /** Snapshot at the last day with data across all positions. */
  final: PortfolioDailyState;

  /** All daily snapshots, ordered by timestamp. */
  daily: PortfolioDailyState[];

  /** `final.totalValueUSD - initial.totalValueUSD`. */
  totalReturnUSD: number;

  /** `(final - initial) / initial`. */
  totalReturnPct: number;

  /**
   * Annualized return: `(1 + totalReturnPct) ^ (365 / days) - 1`.
   * `days = daily.length - 1` so a single-day portfolio produces 0%.
   */
  annualizedReturnPct: number;

  /**
   * Worst single-day portfolio loss, as a fraction of the prior day's
   * `totalValueUSD`. Always ≤ 0; 0 when no day lost money.
   */
  worstDayLossPct: number;

  /**
   * Mean of the off-diagonal entries of the Pearson correlation matrix
   * computed from each position's daily returns.
   *
   * `null` when fewer than 2 positions, or when the backtest window is
   * too short to compute meaningful correlations.
   */
  meanInterPositionCorrelation: number | null;
}
