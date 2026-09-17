import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { simulationRequestSchema } from '@/lib/validation/schemas';
import { runDeterministicScenario } from '@/lib/simulation/deterministic';
import { estimateFees } from '@/lib/univ3/fees';
import { calculatePositionEntry } from '@/lib/univ3/position';
import { tickToPrice } from '@/lib/univ3/math';
import { getPoolByAddress } from '@/lib/data/pools';
import { fetchPoolState } from '@/lib/data/rpc';
import { getPoolMetrics } from '@/lib/data/defillama';
import { apiConfig } from '@/lib/api/handler';

export const { dynamic, runtime } = apiConfig();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = simulationRequestSchema.parse(body);

    // Fetch pool data
    const [pool, poolState] = await Promise.all([
      getPoolByAddress(params.chainId, params.poolAddress),
      fetchPoolState(params.chainId, params.poolAddress).catch(() => null),
    ]);

    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found', suggestion: 'Check the pool address or try a different chain.' },
        { status: 404 }
      );
    }

    // Get current price from pool state
    const currentPrice = poolState?.token0Price || 1;
    const lowerPrice = tickToPrice(params.lowerTick);
    const upperPrice = tickToPrice(params.upperTick);

    // Get pool metrics for volume estimate
    const metrics = await getPoolMetrics(params.chainId, params.poolAddress);
    const dailyVolumeUSD = metrics?.volumeUsd1d || 1000000; // Fallback to 1M if no data

    // Calculate entry
    const entryResult = calculatePositionEntry({
      depositAmount: parseFloat(params.depositAmount),
      depositToken: params.depositToken,
      currentPrice,
      lowerPrice,
      upperPrice,
      token0Decimals: pool.token0.decimals,
      token1Decimals: pool.token1.decimals,
    });

    // Run scenario
    const scenarioGrid = runDeterministicScenario({
      entryPrice: currentPrice,
      token0Decimals: pool.token0.decimals,
      token1Decimals: pool.token1.decimals,
      lowerPrice,
      upperPrice,
      depositAmount: parseFloat(params.depositAmount),
      depositToken: params.depositToken,
      dailyVolumeUSD,
      feeTier: pool.feeTier,
      liquidityShare: Number(entryResult.liquidity) / Number(poolState?.liquidity || 1),
      horizonDays: params.horizonDays,
      gasCostGwei: params.gasCostGwei,
      rebalanceCount: 0,
    }, {
      min: currentPrice * 0.1,
      max: currentPrice * 4,
      steps: 50,
    });

    // Estimate fees
    const timeInRange = scenarioGrid.filter((s) => s.inRange).length / scenarioGrid.length;
    const feeEstimates = estimateFees({
      currentLiquidity: poolState?.liquidity || 0n,
      activeLiquidityInRange: poolState?.liquidity || 0n,
      feeTier: pool.feeTier,
      dailyVolumeUSD,
      volumeScenario: params.volumeScenario,
      customVolumeMultiplier: params.customVolumeMultiplier,
      positionLiquidity: entryResult.liquidity,
      timeInRange,
      horizonDays: params.horizonDays,
    });

    // Calculate summary
    const avgIL = scenarioGrid.reduce((sum, s) => sum + s.divergenceLoss, 0) / scenarioGrid.length;
    const avgNetReturn = scenarioGrid.reduce((sum, s) => sum + s.excessReturnVsHODL, 0) / scenarioGrid.length;

    return NextResponse.json({
      simulationId: `sim_${Date.now()}`,
      results: {
        scenarioGrid,
        feeEstimates,
        summary: {
          estimatedFeesMin: feeEstimates.min,
          estimatedFeesMax: feeEstimates.max,
          estimatedIL: avgIL,
          netReturnVsHODL: avgNetReturn,
          timeInRange,
        },
      },
      charts: {
        lpVsHodl: {
          labels: scenarioGrid.map((s) => s.priceChangePercent),
          datasets: [
            { label: 'LP Value', data: scenarioGrid.map((s) => s.lpValue) },
            { label: 'HODL Value', data: scenarioGrid.map((s) => s.hodlValue) },
          ],
        },
        ilByPrice: {
          labels: scenarioGrid.map((s) => s.priceChangePercent),
          datasets: [
            { label: 'IL %', data: scenarioGrid.map((s) => s.divergenceLoss) },
          ],
        },
        feeDistribution: {
          labels: ['Min', 'Base', 'Max'],
          datasets: [
            { label: 'Fees', data: [feeEstimates.min, feeEstimates.base, feeEstimates.max] },
          ],
        },
      },
      warnings: [],
    });
  } catch (error) {
    console.error('Simulation error:', error);

    // Validation errors (zod) are 400, not 500. The previous catch block
    // surfaced them as 500 which broke clients that send invalid bodies
    // and trusted the status code to drive UX. Surfaced by perf bench
    // (commit 8c93c6f) — `/api/simulations` returned 500:100 at every
    // concurrency because the bench sent `{ /* TODO */ }`.
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          message: 'Request did not match expected schema',
          details: error.flatten(),
          suggestion: 'Check the inputs and try again.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Simulation failed',
        message: (error as Error).message,
        suggestion: 'Check your inputs and try again.',
      },
      { status: 500 }
    );
  }
}
