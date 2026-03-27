/**
 * DeFi Llama API Integration
 * 
 * FREE pool data - no API key required
 * Endpoint: https://api.llama.fi/pools/{chain}
 */

import { Pool, PoolMetrics } from '@/types';

// Cache for DeFi Llama responses
const cache = new Map<string, { data: Pool[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Chain slug mapping for DeFi Llama
const CHAIN_SLUGS: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  8453: 'base',
  10: 'optimism',
  137: 'polygon',
};

// DeFi Llama pool response
interface LlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase?: number;
  apyReward?: number;
  apy?: number;
  volumeUsd1d?: number;
  volumeUsd7d?: number;
  rewardTokens?: string[];
  underlyingTokens?: string[];
}

/**
 * Fetch pools from DeFi Llama for a specific chain
 * @param chainId - Chain ID
 * @returns Array of Pool objects
 */
export async function fetchLlamaPools(chainId: number): Promise<Pool[]> {
  const chainSlug = CHAIN_SLUGS[chainId];
  if (!chainSlug) {
    console.warn(`Chain ${chainId} not supported by DeFi Llama`);
    return [];
  }

  const cacheKey = `llama-${chainId}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`https://api.llama.fi/pools/${chainSlug}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`DeFi Llama API error: ${response.status}`);
    }

    const data = await response.json();
    const pools: LlamaPool[] = data.data || [];
    
    // Filter for Uniswap V3 pools and map to our Pool type
    const uniswapPools = pools
      .filter((pool: LlamaPool) => 
        pool.project?.toLowerCase().includes('uniswap') || 
        pool.project?.toLowerCase().includes('univ3')
      )
      .map((pool: LlamaPool) => mapLlamaPoolToPool(pool, chainId));

    // Cache the result
    cache.set(cacheKey, { data: uniswapPools, timestamp: Date.now() });

    return uniswapPools;
  } catch (error) {
    console.error('Failed to fetch DeFi Llama pools:', error);
    return cached?.data || [];
  }
}

/**
 * Map DeFi Llama pool to our Pool type
 */
function mapLlamaPoolToPool(llamaPool: LlamaPool, chainId: number): Pool {
  // Parse symbol (e.g., "WETH-USDC" or "ETH-USDC 0.05%")
  const symbolParts = llamaPool.symbol.split(' ');
  const tokenPair = symbolParts[0].split('-');
  const feePart = symbolParts.find(p => p.includes('%'));
  
  const token0Symbol = tokenPair[0] || 'UNKNOWN';
  const token1Symbol = tokenPair[1] || 'UNKNOWN';
  
  // Extract fee tier from symbol or default to 0.3%
  let feeTier = 3000;
  if (feePart) {
    const feeMatch = feePart.match(/(\d+\.?\d*)%/);
    if (feeMatch) {
      const feePercent = parseFloat(feeMatch[1]);
      feeTier = Math.round(feePercent * 100); // Convert % to basis points
    }
  }

  // Get tick spacing from fee tier
  const tickSpacing = feeTier === 100 ? 1 : 
                      feeTier === 500 ? 10 : 
                      feeTier === 3000 ? 60 : 
                      feeTier === 10000 ? 200 : 60;

  // Calculate APR from APY if available
  const apr = llamaPool.apyBase || llamaPool.apy || 0;

  return {
    chainId,
    address: llamaPool.pool?.split(':')[1] || '',
    token0: {
      chainId,
      address: '', // Will be filled by RPC
      symbol: token0Symbol,
      name: token0Symbol,
      decimals: 18,
      verified: true,
    },
    token1: {
      chainId,
      address: '', // Will be filled by RPC
      symbol: token1Symbol,
      name: token1Symbol,
      decimals: 6, // Most quote tokens are 6 decimals
      verified: true,
    },
    feeTier,
    tickSpacing,
    tvlUSD: llamaPool.tvlUsd,
    volumeUSD24h: llamaPool.volumeUsd1d,
    apr: apr / 100, // Convert from percentage to decimal
  };
}

/**
 * Get pool metrics from DeFi Llama
 * @param chainId - Chain ID
 * @param poolAddress - Pool address
 * @returns Pool metrics or null
 */
export async function getLlamaPoolMetrics(
  chainId: number,
  poolAddress: string
): Promise<PoolMetrics | null> {
  try {
    const pools = await fetchLlamaPools(chainId);
    const pool = pools.find(p => 
      p.address.toLowerCase() === poolAddress.toLowerCase()
    );
    
    if (!pool) return null;

    return {
      tvlUSD: pool.tvlUSD || 0,
      volumeUSD24h: pool.volumeUSD24h || 0,
      feesUSD24h: 0, // Would need to calculate from volume
      apr: pool.apr || 0,
    };
  } catch (error) {
    console.error('Failed to get pool metrics:', error);
    return null;
  }
}

/**
 * Clear the cache
 */
export function clearLlamaCache(): void {
  cache.clear();
}
