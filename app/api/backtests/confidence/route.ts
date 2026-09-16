/**
 * POST /api/backtests/confidence
 *
 * Compute percentile-based confidence bands from a sequence of per-window
 * outcomes (e.g. weekly APRs returned by a backtest). Pure compute endpoint;
 * no caching — every request is fresh so the caller sees the result of the
 * exact parameters they sent.
 *
 * Body:
 *   {
 *     windowOutcomes: number[];   // required, length 5..1000
 *     bootstrapSamples?: number;  // default 1000, integer 1..10000
 *     percentiles?: number[];     // default [5,25,50,75,95], each in [0,100],
 *                                 // sorted strictly ascending
 *     seed?: number;              // optional, non-negative integer
 *   }
 *
 * Response: `ConfidenceBands` from `lib/simulation/confidence`.
 */

import { z } from 'zod';
import { apiHandler, apiConfig } from '@/lib/api/handler';
import { RateLimitPresets } from '@/lib/api/rate-limit';
import {
  computeConfidenceBands,
  ConfidenceBands,
  ConfidenceConfig,
} from '@/lib/simulation/confidence';

export const { dynamic, runtime } = apiConfig();

const bodySchema = z.object({
  windowOutcomes: z.array(z.number()).min(5).max(1000),
  bootstrapSamples: z.number().int().positive().max(10000).optional(),
  percentiles: z.array(z.number().min(0).max(100)).min(1).max(20).optional(),
  seed: z.number().int().nonnegative().optional(),
});

export const POST = apiHandler<z.infer<typeof bodySchema>, ConfidenceBands>({
  name: 'backtests.confidence',
  schema: bodySchema,
  source: 'body',
  rateLimit: RateLimitPresets.compute,
  handler: async ({ params }) => {
    const config: ConfidenceConfig = {};
    if (params.bootstrapSamples !== undefined) {
      config.bootstrapSamples = params.bootstrapSamples;
    }
    if (params.percentiles !== undefined) {
      config.percentiles = params.percentiles;
    }
    if (params.seed !== undefined) {
      config.seed = params.seed;
    }
    return computeConfidenceBands(params.windowOutcomes, config);
  },
});