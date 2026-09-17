/**
 * Real-data backtest runner.
 *
 * Wraps the existing `runBacktest` with a real historical data layer:
 *   - Validates inputs
 *   - Calls `fetchPoolHistoricalData` to obtain price + volume history
 *     (DeFi Llama volume, CoinGecko price, or clearly-flagged modeled path)
 *   - Maps into `BacktestParams` and delegates to the existing simulation
 *
 * Design choices:
 *  - Uses the proven `runBacktest` engine unchanged; only glue code here.
 *  - Errors are surfaced via `HistoricalDataError` so the API layer can map
 *    them to 404/400/500 with consistent envelopes.
 *  - No `any`, no `// @ts-ignore`, no `console.log` debug spam.
 */

import {
  runBacktest,
  BacktestParams,
  BacktestResult,
  PriceDataPoint,
} from '@/lib/simulation/backtest';
import {
  fetchPoolHistoricalData,
  HistoricalDataError,
  HistoricalPoolData,
  HistoricalSource,
} from '@/lib/data/historical';

export type { HistoricalDataError, HistoricalSource };

export interface RealBacktestParams {
  chainId: number;
  poolAddress: `0x${string}`;
  lowerPrice: number;
  upperPrice: number;
  depositAmount: number;
  depositToken: 'token0' | 'token1' | 'usd';
  rebalanceMode: 'none' | 'periodic' | 'threshold' | 'volatility';
  rebalanceParams?: {
    periodDays?: number;
    priceThreshold?: number;
    volatilityThreshold?: number;
  };
  gasCostGwei: number;
  gasUnitsPerRebalance: number;
  token0Decimals: number;
  token1Decimals: number;
  feeTier: number;
  /** How many days of history to fetch. 1..365. */
  days: number;
}

export interface RealBacktestResult {
  historical: BacktestResult;
  dataSource: HistoricalSource;
  dataPointsUsed: number;
  fetchTimestamp: string;
}

/**
 * Public entry point. Throws `HistoricalDataError` on input / upstream
 * failure so the API layer can map it to the right HTTP status code.
 */
export async function runRealBacktest(
  params: RealBacktestParams,
): Promise<RealBacktestResult> {
  // ---- Input validation (defensive — the API layer also validates) ----
  if (!Number.isInteger(params.chainId) || params.chainId <= 0) {
    throw new HistoricalDataError(
      'INVALID_INPUT',
      `Invalid chainId: ${String(params.chainId)}`,
    );
  }
  if (typeof params.poolAddress !== 'string' ||
      !/^0x[a-fA-F0-9]{40}$/.test(params.poolAddress)) {
    throw new HistoricalDataError(
      'INVALID_INPUT',
      `Invalid poolAddress: ${String(params.poolAddress)}`,
    );
  }
  if (!Number.isFinite(params.lowerPrice) || params.lowerPrice <= 0 ||
      !Number.isFinite(params.upperPrice) || params.upperPrice <= 0) {
    throw new HistoricalDataError(
      'INVALID_INPUT',
      'lowerPrice and upperPrice must be positive numbers',
    );
  }
  if (params.lowerPrice >= params.upperPrice) {
    throw new HistoricalDataError(
      'INVALID_INPUT',
      'lowerPrice must be strictly less than upperPrice',
    );
  }
  if (!Number.isFinite(params.depositAmount) || params.depositAmount <= 0) {
    throw new HistoricalDataError(
      'INVALID_INPUT',
      'depositAmount must be a positive number',
    );
  }
  if (!Number.isInteger(params.days) ||
      params.days < 1 || params.days > 365) {
    throw new HistoricalDataError(
      'INVALID_INPUT',
      'days must be an integer in [1, 365]',
    );
  }

  // ---- Real data fetch ----
  let historical: HistoricalPoolData;
  try {
    historical = await fetchPoolHistoricalData(
      params.chainId,
      params.poolAddress,
      params.days,
    );
  } catch (err) {
    if (err instanceof HistoricalDataError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new HistoricalDataError('UPSTREAM', `Failed to fetch historical data: ${msg}`);
  }

  if (historical.points.length < 2) {
    throw new HistoricalDataError(
      'UPSTREAM',
      `Historical data has insufficient points: ${historical.points.length}`,
    );
  }

  // ---- Map into BacktestParams ----
  const priceHistory: PriceDataPoint[] = historical.points;
  const entryTimestamp = priceHistory[0].timestamp;

  // The engine's daily fee rate is computed as `feeTier / 10000`. V3's
  // on-chain feeTier (uint24) is fee in hundredths-of-a-bip, so we
  // divide by 100 to land at the engine's expected units (fee in
  // hundredths-of-a-PERCENT, e.g. 500 V3 → 5 engine). Without this
  // normalization the simulator projects ~100x the correct fee revenue.
  const engineFeeTier = params.feeTier / 100;

  const backtestParams: BacktestParams = {
    priceHistory,
    entryTimestamp,
    lowerPrice: params.lowerPrice,
    upperPrice: params.upperPrice,
    depositAmount: params.depositAmount,
    depositToken: params.depositToken,
    rebalanceMode: params.rebalanceMode,
    ...(params.rebalanceParams ? { rebalanceParams: params.rebalanceParams } : {}),
    gasCostGwei: params.gasCostGwei,
    gasUnitsPerRebalance: params.gasUnitsPerRebalance,
    token0Decimals: params.token0Decimals,
    token1Decimals: params.token1Decimals,
    feeTier: engineFeeTier,
  };

  // ---- Delegate to the existing engine ----
  const result = runBacktest(backtestParams);

  return {
    historical: result,
    dataSource: historical.source,
    dataPointsUsed: historical.points.length,
    fetchTimestamp: new Date().toISOString(),
  };
}
