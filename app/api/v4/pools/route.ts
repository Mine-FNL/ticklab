/**
 * GET /api/v4/pools
 *
 * Discover Uniswap V4 pools for a token pair or single token.
 *
 * Query params:
 *   - chainId: number (default 1)
 *   - tokenA?: address (required when mode='pair')
 *   - tokenB?: address (required when mode='pair')
 *   - mode?: 'pair' | 'single' (default 'pair')
 *   - knownHookAddresses?: comma-separated address list (optional)
 *   - limit?: number (default 50, max 200)
 *
 * Returns the subset of (feeTier x hooks) combinations where the on-chain
 * PoolManager confirms the pool exists.
 */

import { z } from 'zod';
import { apiHandler, apiConfig } from '@/lib/api/handler';
import { RateLimitPresets } from '@/lib/api/rate-limit';
import {
  discoverV4Pools,
  discoverV4PoolsByToken,
  V4Pool,
} from '@/lib/univ4/pool';

export const { dynamic, runtime } = apiConfig();

const HEX_ADDRESS = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const querySchema = z.object({
  chainId: z.coerce.number().int().positive().default(1),
  mode: z.enum(['pair', 'single']).default('pair'),
  tokenA: HEX_ADDRESS.optional(),
  tokenB: HEX_ADDRESS.optional(),
  knownHookAddresses: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

interface V4PoolsResponse {
  chainId: number;
  mode: 'pair' | 'single';
  pools: V4Pool[];
  count: number;
  warnings: string[];
}

export const GET = apiHandler<z.infer<typeof querySchema>, V4PoolsResponse>({
  name: 'v4.pools.discover',
  schema: querySchema,
  rateLimit: RateLimitPresets.discover,
  cacheTtlMs: 60_000,
  handler: async ({ params }) => {
    const warnings: string[] = [];
    if (params.mode === 'pair') {
      if (!params.tokenA || !params.tokenB) {
        const err = new Error('tokenA and tokenB are required for mode=pair');
        (err as Error & { __clientError?: boolean }).__clientError = true;
        throw err;
      }
      if (params.tokenA.toLowerCase() === params.tokenB.toLowerCase()) {
        const err = new Error('tokenA and tokenB must differ');
        (err as Error & { __clientError?: boolean }).__clientError = true;
        throw err;
      }
    } else if (params.mode === 'single' && !params.tokenA) {
      const err = new Error('tokenA is required for mode=single');
      (err as Error & { __clientError?: boolean }).__clientError = true;
      throw err;
    }

    const knownHookAddresses = params.knownHookAddresses
      ? params.knownHookAddresses
          .split(',')
          .map((s) => s.trim())
          .filter((s) => HEX_ADDRESS.safeParse(s).success)
      : undefined;

    const allPools: V4Pool[] =
      params.mode === 'pair'
        ? await discoverV4Pools(
            params.chainId,
            params.tokenA!,
            params.tokenB!,
            knownHookAddresses
          )
        : await discoverV4PoolsByToken(params.chainId, params.tokenA!, knownHookAddresses);

    if (allPools.length === 0) {
      warnings.push(
        'No V4 pools found for this pair/token on this chain. Verify the pair exists on Uniswap V4 and that PoolManager is deployed.'
      );
    }

    const pools = allPools.slice(0, params.limit);

    return {
      chainId: params.chainId,
      mode: params.mode,
      pools,
      count: pools.length,
      warnings,
    };
  },
});