/**
 * DeFi Llama API Client - REAL Data Only
 * 
 * This module fetches REAL pool metrics (TVL, volume, APR) from DeFi Llama.
 * NO FALLBACKS - If the API fails, an error is thrown.
 * 
 * API: https://api.llama.fi
 * Rate limit: ~100 requests/minute
 * No API key required
 */

import { DEFILLAMA_API, DEFILLAMA_CHAIN_SLUGS, CACHE_TTL } from '@/lib/constants';

export interface DefiLlamaPool {
  pool: string;           // Pool ID (chain:address format)
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase?: number;
  apyReward?: number;
  apy?: number;
  rewardTokens?: string[];
  underlyingTokens?: string[];
  volumeUsd1d?: number;
  volumeUsd7d?: number;
}

// Cache for DeFi Llama data
const cache = new Map<string, { data: DefiLlamaPool[]; timestamp: number }>();

/**
 * Fetch all Uniswap V3 pools from DeFi Llama for a specific chain
 * Returns REAL TVL, volume, and APR data
 * 
 * @param chainId - Chain ID
 * @returns Array of pool data from DeFi Llama
 * @throws Error if API fails
 */
export async function fetchDefiLlamaPools(chainId: number): Promise<DefiLlamaPool[]> {
  const chainSlug = DEFILLAMA_CHAIN_SLUGS[chainId];
  if (!chainSlug) {
    throw new Error(`Chain ${chainId} not supported by DeFi Llama`);
  }

  const cacheKey = `pools-${chainId}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL.DEFILLAMA_DATA) {
    return cached.data;
  }

  const url = `${DEFILLAMA_API.BASE_URL}/pools/${chainSlug}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`DeFi Llama API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('Invalid response format from DeFi Llama API');
  }
  
  // Filter for Uniswap V3 pools only
  const uniswapPools = data.data.filter(
    (pool: DefiLlamaPool) => pool.project?.toLowerCase().includes('uniswap') || 
                             pool.project?.toLowerCase().includes('univ3')
  );

  // Cache the result
  cache.set(cacheKey, { data: uniswapPools, timestamp: Date.now() });

  return uniswapPools;
}

/**
 * Fetch specific pool data from DeFi Llama
 * 
 * @param poolId - Pool ID in format "chain:address"
 * @returns Pool data
 * @throws Error if API fails or pool not found
 */
export async function fetchDefiLlamaPool(poolId: string): Promise<DefiLlamaPool> {
  const cacheKey = `pool-${poolId}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL.DEFILLAMA_DATA) {
    return cached.data[0];
  }

  const url = `${DEFILLAMA_API.BASE_URL}/pool/${poolId}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`DeFi Llama API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.data || data.data.length === 0) {
    throw new Error(`Pool ${poolId} not found in DeFi Llama`);
  }

  const pool = data.data[0];
  cache.set(cacheKey, { data: [pool], timestamp: Date.now() });
  
  return pool;
}

/**
 * Get pool metrics (TVL, volume, APR) for a specific pool address
 * Returns REAL metrics from DeFi Llama
 * 
 * @param chainId - Chain ID
 * @param poolAddress - Pool contract address
 * @returns Pool metrics
 * @throws Error if API fails or pool not found
 */
export async function getPoolMetrics(
  chainId: number, 
  poolAddress: string
): Promise<{
  tvlUsd: number;
  volumeUsd1d?: number;
  volumeUsd7d?: number;
  apy?: number;
  apyBase?: number;
}> {
  const chainSlug = DEFILLAMA_CHAIN_SLUGS[chainId]?.toLowerCase();
  if (!chainSlug) {
    throw new Error(`Chain ${chainId} not supported by DeFi Llama`);
  }

  const poolId = `${chainSlug}:${poolAddress.toLowerCase()}`;
  
  try {
    // Try to fetch specific pool first
    const pool = await fetchDefiLlamaPool(poolId);
    
    return {
      tvlUsd: pool.tvlUsd,
      volumeUsd1d: pool.volumeUsd1d,
      volumeUsd7d: pool.volumeUsd7d,
      apy: pool.apy,
      apyBase: pool.apyBase,
    };
  } catch {
    // If specific pool fetch fails, search in all pools
    const allPools = await fetchDefiLlamaPools(chainId);
    const found = allPools.find(p => 
      p.pool.toLowerCase().includes(poolAddress.toLowerCase())
    );
    
    if (!found) {
      throw new Error(`Pool ${poolAddress} not found in DeFi Llama data`);
    }
    
    return {
      tvlUsd: found.tvlUsd,
      volumeUsd1d: found.volumeUsd1d,
      volumeUsd7d: found.volumeUsd7d,
      apy: found.apy,
      apyBase: found.apyBase,
    };
  }
}

/**
 * Get top pools by TVL for a chain
 * 
 * @param chainId - Chain ID
 * @param limit - Maximum number of pools to return
 * @returns Top pools sorted by TVL
 * @throws Error if API fails
 */
export async function getTopPoolsByTVL(
  chainId: number,
  limit: number = 10
): Promise<DefiLlamaPool[]> {
  const pools = await fetchDefiLlamaPools(chainId);
  
  return pools
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, limit);
}

/**
 * Calculate estimated APR from volume and TVL
 * This is a calculation, not a fallback - uses real data
 * 
 * @param volumeUsd24h - 24h volume in USD
 * @param tvlUsd - TVL in USD
 * @param feeTier - Pool fee tier (in basis points)
 * @returns Estimated APR as decimal
 */
export function calculateEstimatedAPR(
  volumeUsd24h: number,
  tvlUsd: number,
  feeTier: number
): number {
  if (tvlUsd === 0) return 0;
  
  const feeRate = feeTier / 1_000_000; // Convert basis points to decimal
  const dailyFees = volumeUsd24h * feeRate;
  const dailyReturn = dailyFees / tvlUsd;
  const annualAPR = dailyReturn * 365;
  
  return annualAPR;
}

/**
 * Clear the cache
 */
export function clearDefiLlamaCache(): void {
  cache.clear();
}
