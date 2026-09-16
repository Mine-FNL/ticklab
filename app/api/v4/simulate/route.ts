/**
 * POST /api/v4/simulate
 *
 * Run a V4 hook-aware scenario simulation.
 *
 * Body schema mirrors lib/univ4/simulation.V4SimulationParams.
 * The simulation engine is CPU-bound and safe to run on the server.
 */

import { z } from 'zod';
import { apiHandler, apiConfig } from '@/lib/api/handler';
import { RateLimitPresets } from '@/lib/api/rate-limit';
import {
  simulateV4LP,
  optimizeV4Range,
  V4SimulationResult,
} from '@/lib/univ4/simulation';

export const { dynamic, runtime } = apiConfig();

const bodySchema = z.object({
  entryPrice: z.number().positive(),
  lowerPrice: z.number().positive(),
  upperPrice: z.number().positive(),
  depositAmount: z.number().positive(),
  depositToken: z.enum(['token0', 'token1', 'usd']).default('usd'),
  baseFeeTier: z.number().int().positive(),
  volume24h: z.number().nonnegative(),
  poolLiquidity: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  yourLiquidity: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  horizonDays: z.number().int().positive().max(365),
  gasCostGwei: z.number().nonnegative().default(20),
  hookId: z.string().optional(),
  hookAddress: z.string().optional(),
  isStaking: z.boolean().optional(),
  volatility: z.number().nonnegative().max(5),
  estimatedDailySwaps: z.number().int().nonnegative().default(50),
  optimizeRange: z.boolean().optional(),
});

interface V4SimulateResponse {
  simulation: V4SimulationResult;
  optimizedRange?: ReturnType<typeof optimizeV4Range>;
}

export const POST = apiHandler<z.infer<typeof bodySchema>, V4SimulateResponse>({
  name: 'v4.simulate',
  schema: bodySchema,
  source: 'body',
  rateLimit: RateLimitPresets.compute,
  handler: async ({ params }) => {
    if (params.lowerPrice >= params.upperPrice) {
      const err = new Error('lowerPrice must be < upperPrice');
      (err as Error & { __clientError?: boolean }).__clientError = true;
      throw err;
    }
    if (params.entryPrice <= 0) {
      const err = new Error('entryPrice must be > 0');
      (err as Error & { __clientError?: boolean }).__clientError = true;
      throw err;
    }

    const simulation = simulateV4LP({
      entryPrice: params.entryPrice,
      lowerPrice: params.lowerPrice,
      upperPrice: params.upperPrice,
      depositAmount: params.depositAmount,
      depositToken: params.depositToken,
      baseFeeTier: params.baseFeeTier,
      volume24h: params.volume24h,
      poolLiquidity: params.poolLiquidity,
      yourLiquidity: params.yourLiquidity,
      horizonDays: params.horizonDays,
      gasCostGwei: params.gasCostGwei,
      hookId: params.hookId,
      hookAddress: params.hookAddress,
      isStaking: params.isStaking,
      volatility: params.volatility,
      estimatedDailySwaps: params.estimatedDailySwaps,
    });

    let optimizedRange;
    if (params.optimizeRange) {
      optimizedRange = optimizeV4Range({
        currentPrice: params.entryPrice,
        volatility: params.volatility,
        hookId: params.hookId,
      });
    }

    return { simulation, optimizedRange };
  },
});