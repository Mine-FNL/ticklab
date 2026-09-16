/**
 * POST /api/v4/hooks/recommend
 *
 * Recommend hooks for a given strategy profile.
 */

import { z } from 'zod';
import { apiHandler, apiConfig } from '@/lib/api/handler';
import { RateLimitPresets } from '@/lib/api/rate-limit';
import { recommendHooks } from '@/lib/univ4/hooks';

export const { dynamic, runtime } = apiConfig();

const bodySchema = z.object({
  pairSymbol: z.string().optional(),
  chainId: z.number().int().positive(),
  baseAPR: z.number().nonnegative(),
  volatility: z.number().nonnegative().max(5),
  riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
  timeHorizonDays: z.number().int().positive().default(30),
  maxResults: z.number().int().positive().max(20).default(5),
});

export const POST = apiHandler<z.infer<typeof bodySchema>, {
  recommendations: ReturnType<typeof recommendHooks>;
  count: number;
}>({
  name: 'v4.hooks.recommend',
  schema: bodySchema,
  source: 'body',
  rateLimit: RateLimitPresets.read,
  handler: async ({ params }) => {
    const all = recommendHooks({
      pairSymbol: params.pairSymbol ?? '',
      chainId: params.chainId,
      baseAPR: params.baseAPR,
      volatility: params.volatility,
      riskTolerance: params.riskTolerance,
      timeHorizonDays: params.timeHorizonDays,
    });
    return { recommendations: all.slice(0, params.maxResults), count: all.length };
  },
});