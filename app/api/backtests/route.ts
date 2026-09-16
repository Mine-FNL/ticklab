import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backtestRequestSchema } from '@/lib/validation/schemas';
import { runBacktest } from '@/lib/simulation/backtest';
import { runRealBacktest } from '@/lib/simulation/backtest-real';
import { HistoricalDataError } from '@/lib/data/historical';
import { getPoolByAddress } from '@/lib/data/pools';
import { tickToPrice } from '@/lib/univ3/math';
import { apiConfig } from '@/lib/api/handler';
import {
  compoundWindowReturns,
  computeConfidenceBands,
  type ConfidenceBands,
} from '@/lib/simulation/confidence';
import {
  runChecklist,
  checklistInputSchema,
  type ChecklistInput,
  type ChecklistResult,
} from '@/lib/simulation/checklist';

export const { dynamic, runtime } = apiConfig();

/**
 * Additive extension of `backtestRequestSchema` with opt-in fields:
 *   - `useRealData`: when true, fetch real historical data via DeFi Llama
 *     volume + CoinGecko prices (falling back to a clearly-flagged modeled
 *     path when CoinGecko has no history for the underlying token).
 *   - `days`: how many days of history to request (1..365, default 30).
 *   - `includeConfidence`: when true, attach a 90% confidence band computed
 *     from rolling 30-day windows of the backtest equity curve.
 *   - `checklistInput`: when provided, run the pre-deposit red-flag rules
 *     and attach a `checklist` block (overall go/caution/no-go + items).
 *
 * Defaults preserve backwards-compatibility — existing callers continue to
 * get the synthetic-data result unchanged.
 */
const realBacktestRequestSchema = backtestRequestSchema.merge(
  z.object({
    useRealData: z.boolean().default(false),
    days: z.number().int().positive().max(365).default(30),
    includeConfidence: z.boolean().default(false),
    confidenceWindowDays: z.number().int().positive().max(120).default(30),
    checklistInput: checklistInputSchema.optional(),
  }),
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = realBacktestRequestSchema.parse(body);

    // Fetch pool data
    const pool = await getPoolByAddress(params.chainId, params.poolAddress);
    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found', suggestion: 'Check the pool address or try a different chain.' },
        { status: 404 }
      );
    }

    const startTime = new Date(params.startDate).getTime();
    const endTime = new Date(params.endDate).getTime();
    const days = Math.floor((endTime - startTime) / (24 * 60 * 60 * 1000));

    if (days <= 0) {
      return NextResponse.json(
        { error: 'Invalid date range', suggestion: 'End date must be after start date.' },
        { status: 400 }
      );
    }

    // Calculate lower and upper prices from ticks (used by both branches)
    const lowerPrice = tickToPrice(params.lowerTick);
    const upperPrice = tickToPrice(params.upperTick);

    // Optional confidence bands + checklist results, attached when requested.
    let confidenceBands: ConfidenceBands | null = null;
    let checklistResult: ChecklistResult | null = null;

    // Pre-compute checklist if requested (independent of the backtest path).
    if (params.checklistInput) {
      try {
        checklistResult = runChecklist(params.checklistInput as ChecklistInput);
      } catch (err) {
        // Checklist failure should not poison the backtest response.
        // eslint-disable-next-line no-console
        console.error('[backtests] checklist failed:', err);
      }
    }

    // ---------------------------------------------------------------
    // NEW: opt-in real-data path (additive — old behaviour is below)
    // ---------------------------------------------------------------
    if (params.useRealData) {
      try {
        const real = await runRealBacktest({
          chainId: params.chainId,
          // poolAddress is regex-validated upstream (Ethereum address format)
          // so this cast is safe — `runRealBacktest` enforces it again at runtime.
          poolAddress: params.poolAddress as `0x${string}`,
          lowerPrice,
          upperPrice,
          depositAmount: parseFloat(params.depositAmount),
          depositToken: params.depositToken,
          rebalanceMode: params.rebalanceMode,
          ...(params.rebalanceParams ? { rebalanceParams: params.rebalanceParams } : {}),
          gasCostGwei: params.gasCostGwei,
          gasUnitsPerRebalance: 250000,
          token0Decimals: pool.token0.decimals,
          token1Decimals: pool.token1.decimals,
          feeTier: pool.feeTier,
          days: params.days,
        });

        if (params.includeConfidence) {
          confidenceBands = extractConfidenceBands(
            real.historical.equityCurve,
            params.confidenceWindowDays,
          );
        }

        return NextResponse.json({
          backtestId: `bt_${Date.now()}`,
          useRealData: true,
          results: real.historical,
          dataSource: real.dataSource,
          dataPointsUsed: real.dataPointsUsed,
          fetchTimestamp: real.fetchTimestamp,
          warnings: [],
          ...(confidenceBands ? { confidenceBands } : {}),
          ...(checklistResult ? { checklist: checklistResult } : {}),
        });
      } catch (realErr) {
        if (realErr instanceof HistoricalDataError) {
          const status =
            realErr.code === 'NOT_FOUND' ? 404 :
            realErr.code === 'INVALID_INPUT' ? 400 : 502;
          return NextResponse.json(
            {
              error: realErr.code === 'NOT_FOUND' ? 'pool_not_indexed' : 'upstream_failure',
              useRealData: true,
              message: realErr.message,
              suggestion:
                realErr.code === 'NOT_FOUND'
                  ? 'This pool is not indexed by DeFi Llama; real-data backtests are unavailable.'
                  : 'Try again or lower the `days` value.',
            },
            { status },
          );
        }
        throw realErr;
      }
    }

    // ---------------------------------------------------------------
    // EXISTING: synthetic-data backtest (unchanged)
    // ---------------------------------------------------------------

    // For backtest, we need historical data
    // Since we don't have historical data from free sources, we'll generate synthetic data
    // based on the pool's current metrics

    // Generate synthetic price history based on pool metrics
    // In a production app, you'd fetch real historical data from a paid source
    const priceHistory = [];
    const basePrice = 1; // Normalized price
    const volatility = 0.02; // 2% daily volatility

    let currentPrice = basePrice;
    for (let i = 0; i < days; i++) {
      const timestamp = startTime + i * 24 * 60 * 60 * 1000;
      // Random walk with mean reversion
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = currentPrice * (1 + change);

      // Mean reversion
      currentPrice = currentPrice * 0.99 + basePrice * 0.01;

      priceHistory.push({
        timestamp,
        price: currentPrice,
        volumeUSD: (pool.volumeUSD24h || 1000000) * (0.8 + Math.random() * 0.4),
      });
    }

    // Run backtest
    const backtestResult = runBacktest({
      priceHistory,
      entryTimestamp: priceHistory[0].timestamp,
      lowerPrice,
      upperPrice,
      depositAmount: parseFloat(params.depositAmount),
      depositToken: params.depositToken,
      rebalanceMode: params.rebalanceMode,
      rebalanceParams: params.rebalanceParams,
      gasCostGwei: params.gasCostGwei,
      gasUnitsPerRebalance: 250000,
      token0Decimals: pool.token0.decimals,
      token1Decimals: pool.token1.decimals,
      feeTier: pool.feeTier,
    });

    if (params.includeConfidence) {
      confidenceBands = extractConfidenceBands(
        backtestResult.equityCurve,
        params.confidenceWindowDays,
      );
    }

    return NextResponse.json({
      backtestId: `bt_${Date.now()}`,
      useRealData: false,
      results: backtestResult,
      warnings: [{
        type: 'sparse_data' as const,
        severity: 'info' as const,
        message: 'Backtest uses synthetic price data. For accurate backtesting, use a paid data provider.',
        recommendation: 'Consider using Dune Analytics or TheGraph for real historical data.',
      }],
      ...(confidenceBands ? { confidenceBands } : {}),
      ...(checklistResult ? { checklist: checklistResult } : {}),
    });
  } catch (error) {
    console.error('Backtest error:', error);

    // Zod validation failures should not surface as 500 — they are caller errors.
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          message: 'Request did not match expected schema',
          details: error.flatten(),
          suggestion: 'Check chainId, poolAddress, ticks, dates and rebalance params.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: 'Backtest failed',
        message: (error as Error).message,
        suggestion: 'Check your inputs and try again.'
      },
      { status: 500 }
    );
  }
}

/**
 * Convert an LP equity curve into a ConfidenceBands result by rolling
 * daily returns into windows and computing percentile bands.
 *
 * Windows use stride=1 (fully overlapping) so we get more samples for the
 * percentile estimate when the input series is short. Returns null when
 * there is insufficient data (< 5 windows), so the caller can drop the
 * field from the response instead of returning a half-meaningful band.
 */
function extractConfidenceBands(
  equityCurve: ReadonlyArray<{ timestamp: number; lpValue: number }>,
  windowDays: number,
): ConfidenceBands | null {
  if (equityCurve.length < 2) return null;
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]?.lpValue ?? 0;
    const curr = equityCurve[i]?.lpValue ?? 0;
    if (prev > 0 && Number.isFinite(curr)) {
      dailyReturns.push(curr / prev - 1);
    }
  }
  if (dailyReturns.length < 5) return null;
  const windowSize = Math.max(1, Math.min(windowDays, dailyReturns.length));
  const windows = compoundWindowReturns(dailyReturns, windowSize, { stride: 1 });
  if (windows.length < 5) return null;
  return computeConfidenceBands(windows);
}
