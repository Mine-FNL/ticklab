/**
 * POST /api/analytics/risk
 *
 * Compute the full A16Z-grade risk report for a backtest equity curve.
 *
 * Request body:
 *   {
 *     equityCurve: [{ timestamp: number, lpValue: number }, ...],   // ≥ 2 points
 *     riskFreeRate?: number,        // annual, default 0
 *     annualizationFactor?: number  // default 252 (US trading days)
 *   }
 *
 * Response (200):
 *   RiskReport  — see `lib/analytics/risk-types.ts`
 *
 * Response (4xx):
 *   { error: 'invalid_request' | 'bad_request' | 'rate_limited' | 'internal_error',
 *     message, details?, suggestion?, requestId }
 *
 * This route is pure / CPU-only — it does not touch RPC, the DB, or the
 * cache layer. Rate-limit preset is `compute` (30/min) so a chatty
 * dashboard can't pin a worker.
 */

import { z } from 'zod';
import { apiHandler, apiConfig } from '@/lib/api/handler';
import { RateLimitPresets } from '@/lib/api/rate-limit';
import { computeRiskReport } from '@/lib/analytics/risk';
import type { RiskReport } from '@/lib/analytics/risk-types';

export const { dynamic, runtime } = apiConfig();

const bodySchema = z.object({
  equityCurve: z
    .array(
      z.object({
        timestamp: z.number().finite(),
        lpValue: z.number().finite(),
      }),
    )
    .min(2, 'equityCurve must have at least 2 points to compute returns'),
  riskFreeRate: z.number().finite().optional(),
  annualizationFactor: z.number().int().positive().max(100_000).optional(),
});

export const POST = apiHandler<z.infer<typeof bodySchema>, RiskReport>({
  name: 'analytics.risk',
  schema: bodySchema,
  source: 'body',
  rateLimit: RateLimitPresets.compute,
  handler: async ({ params }) => {
    // Body validation already guarantees ≥ 2 points. We *don't* drop
    // points with lpValue ≤ 0 from the curve here — let `simpleReturns`
    // and `maxDrawdown` handle them. This keeps the route a thin wrapper
    // around the pure-function module.
    const report = computeRiskReport(
      params.equityCurve,
      params.riskFreeRate ?? 0,
      params.annualizationFactor ?? 252,
    );

    // JSON doesn't encode NaN/Infinity — `JSON.stringify(NaN) === 'null'`.
    // We sanitize explicitly so the contract is visible in the type
    // (annualizedReturn is declared `number | null` in RiskReport).
    return sanitizeForJson(report);
  },
});

/**
 * Replace non-finite numbers in a RiskReport with `null`. Only fields
 * that the pure-function module can legitimately return as NaN need to
 * be touched — currently that's `annualizedReturn` (geometric
 * annualization is undefined when 1+R ≤ 0).
 */
function sanitizeForJson(report: RiskReport): RiskReport {
  return {
    ...report,
    annualizedReturn: Number.isFinite(report.annualizedReturn)
      ? report.annualizedReturn
      : null,
  };
}