/**
 * GET /api/v4/hooks
 *
 * List all registered V4 hooks with optional filtering.
 *
 * Query params:
 *   - chainId?: number (filter by chain support)
 *   - category?: HookCategory
 *   - auditedOnly?: boolean
 *   - maxRiskScore?: number  (0-100)
 */

import { z } from 'zod';
import { apiHandler, apiConfig } from '@/lib/api/handler';
import { RateLimitPresets } from '@/lib/api/rate-limit';
import { HOOK_REGISTRY, calculateHookLPScore } from '@/lib/univ4/hooks';
import type { HookCategory } from '@/lib/univ4/hooks';

export const { dynamic, runtime } = apiConfig();

const querySchema = z.object({
  chainId: z.coerce.number().int().positive().optional(),
  category: z.enum(['fee', 'liquidity', 'flow', 'yield', 'risk', 'access', 'custom']).optional(),
  auditedOnly: z.coerce.boolean().optional(),
  baseAPR: z.coerce.number().nonnegative().optional(),
  volatility: z.coerce.number().nonnegative().optional(),
});

interface HookListItem {
  hookId: string;
  name: string;
  category: HookCategory;
  chains: number[];
  address: string;
  behaviors: ReturnType<typeof getHookSummary>;
  score?: ReturnType<typeof calculateHookLPScore>;
}

function getHookSummary(hookId: string) {
  const hook = HOOK_REGISTRY[hookId];
  if (!hook) return null;
  const b = hook.behaviors;
  return {
    feeAdjustment: b.feeAdjustment,
    baseFeeBips: b.baseFeeBips,
    additionalFeeBips: b.additionalFeeBips,
    hookShareBips: b.hookShareBips,
    gasOverheadPerSwap: b.gasOverheadPerSwap,
    flowMultiplier: b.flowMultiplier,
    lockupPeriodDays: b.lockupPeriodDays,
    requiresStaking: b.requiresStaking,
    auditStatus: b.auditStatus,
    description: b.description,
    lpImpact: b.lpImpact,
  };
}

export const GET = apiHandler<z.infer<typeof querySchema>, { hooks: HookListItem[]; count: number }>({
  name: 'v4.hooks.list',
  schema: querySchema,
  rateLimit: RateLimitPresets.read,
  cacheTtlMs: 5 * 60_000,
  handler: async ({ params }) => {
    let entries = Object.entries(HOOK_REGISTRY);

    if (params.chainId) {
      entries = entries.filter(([, h]) => h.chains.includes(params.chainId!));
    }
    if (params.category) {
      entries = entries.filter(([, h]) => h.category === params.category);
    }
    if (params.auditedOnly) {
      entries = entries.filter(([, h]) => h.behaviors.auditStatus === 'audited');
    }

    const baseAPR = params.baseAPR ?? 0.15;
    const volatility = params.volatility ?? 0.8;

    const hooks: HookListItem[] = entries.map(([hookId, hook]) => {
      const summary = getHookSummary(hookId);
      return {
        hookId,
        name: hook.name,
        category: hook.category,
        chains: hook.chains,
        address: hook.address,
        behaviors: summary!,
        score: calculateHookLPScore({
          baseAPR,
          hookId,
          pairVolatility: volatility,
          estimatedDailySwaps: 50,
        }),
      };
    });

    return { hooks, count: hooks.length };
  },
});