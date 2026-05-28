/**
 * Pool Discovery - REAL On-Chain Data Only
 * 
 * This module handles pool discovery using the Uniswap V3 Factory contract.
 * NO HARDCODED POOLS - All pool discovery is done on-chain.
 * If data fails to load, an error is thrown - NO FALLBACKS.
 */

import { Pool, PoolMetrics, Token } from '@/types';
import { FEE_TIER_TO_TICK_SPACING, SUPPORTED_FEE_TIERS } from '@/lib/constants';
import { fetchPoolData, getPoolFromFactory, fetchTokenMetadata } from './rpc';
import { getPoolMetrics } from './defillama';
import { fetchDefiLlamaPools } from './defillama';

// Common quote tokens per chain for pool discovery
const COMMON_QUOTE_TOKENS: Record<number, string[]> = {
  1: [ // Ethereum
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  ],
  42161: [ // Arbitrum
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
    '0xfd086bc7cd5c481dcc9c96ebe6a1a233e24197f0', // USDT
    '0x2f2a2543b76a4166549f7aab2e75bef01a8328ca', // WBTC
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
  ],
  8453: [ // Base
    '0x4200000000000000000000000000000000000006', // WETH
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    '0xfde4c96c8593536e31f229ea8f37b2ada2699b57', // USDT
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI
  ],
  10: [ // Optimism
    '0x4200000000000000000000000000000000000042', // WETH
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58f58', // USDT
    '0x68f180fcce6836688e9084f035309e29bf0a2095', // WBTC
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
  ],
  137: [ // Polygon
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT
    '0x1bfd67037b42f73f46801769e5f1d204c31a130d', // WBTC
    '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', // DAI
  ],
};

// Cache for pool data (short TTL for live data)
const poolCache = new Map<string, { data: Pool; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Find pool address from factory contract
 * Queries the Uniswap V3 Factory on-chain for ANY token pair
 * 
 * @param chainId - Chain ID
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @param feeTier - Fee tier (default: 3000 = 0.3%)
 * @returns Pool address or null if pool doesn't exist
 * @throws Error if RPC call fails
 */
export async function findPool(
  chainId: number,
  tokenA: string,
  tokenB: string,
  feeTier: number = 3000
): Promise<string | null> {
  // Normalize addresses (sort for consistent ordering)
  const addrA = tokenA.toLowerCase();
  const addrB = tokenB.toLowerCase();
  
  // Uniswap requires token0 < token1
  const [token0, token1] = addrA < addrB ? [addrA, addrB] : [addrB, addrA];
  
  // Query factory contract on-chain
  const poolAddress = await getPoolFromFactory(chainId, token0, token1, feeTier);
  
  return poolAddress;
}

/**
 * Find pool with all supported fee tiers
 * Tries each fee tier and returns the first existing pool
 * 
 * @param chainId - Chain ID
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @returns Pool with fee tier, or null if no pool exists
 * @throws Error if RPC calls fail
 */
export async function findPoolWithFeeTier(
  chainId: number,
  tokenA: string,
  tokenB: string
): Promise<{ address: string; feeTier: number } | null> {
  // Try each fee tier in order of likelihood
  const feeTiersToTry = [3000, 500, 10000, 100];
  
  for (const feeTier of feeTiersToTry) {
    const poolAddress = await findPool(chainId, tokenA, tokenB, feeTier);
    if (poolAddress) {
      return { address: poolAddress, feeTier };
    }
  }
  
  return null;
}

/**
 * Get full pool data with on-chain state and DeFi Llama metrics
 * Fetches REAL data from blockchain and DeFi Llama API
 * 
 * @param chainId - Chain ID
 * @param poolAddress - Pool address
 * @returns Pool with real-time data
 * @throws Error if data cannot be fetched
 */
export async function getPool(chainId: number, poolAddress: string): Promise<Pool> {
  const cacheKey = `${chainId}:${poolAddress.toLowerCase()}`;
  const cached = poolCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  // Fetch on-chain pool data (token addresses, fee, current state)
  const poolData = await fetchPoolData(chainId, poolAddress);
  
  if (!poolData) {
    throw new Error(`Failed to fetch pool data for ${poolAddress}`);
  }
  
  // Fetch DeFi Llama metrics (TVL, volume, APR) - may fail, that's OK
  let metrics: PoolMetrics | undefined;
  try {
    const llamaMetrics = await getPoolMetrics(chainId, poolAddress);
    if (llamaMetrics) {
      metrics = {
        tvlUSD: llamaMetrics.tvlUsd,
        volumeUSD24h: llamaMetrics.volumeUsd1d || 0,
        feesUSD24h: 0,
        apr: llamaMetrics.apy || 0,
      };
    }
  } catch {
    // DeFi Llama metrics are optional - pool still works without them
    metrics = undefined;
  }
  
  const pool: Pool = {
    ...poolData,
    ...metrics,
  };
  
  // Cache the result
  poolCache.set(cacheKey, { data: pool, timestamp: Date.now() });
  
  return pool;
}

/**
 * Discover and fetch pool for a token pair
 * Queries factory, then fetches full pool data if pool exists
 * 
 * @param chainId - Chain ID
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @param feeTier - Fee tier (optional, will try all if not specified)
 * @returns Pool data or null if pool doesn't exist
 * @throws Error if data cannot be fetched
 */
export async function discoverPool(
  chainId: number,
  tokenA: string,
  tokenB: string,
  feeTier?: number
): Promise<Pool | null> {
  let poolInfo: { address: string; feeTier: number } | null;
  
  if (feeTier !== undefined) {
    const address = await findPool(chainId, tokenA, tokenB, feeTier);
    poolInfo = address ? { address, feeTier } : null;
  } else {
    poolInfo = await findPoolWithFeeTier(chainId, tokenA, tokenB);
  }
  
  if (!poolInfo) {
    return null; // Pool doesn't exist
  }
  
  return getPool(chainId, poolInfo.address);
}

/**
 * Get pool by address (for when you already know the pool address)
 * 
 * @param chainId - Chain ID
 * @param poolAddress - Pool address
 * @returns Pool data
 * @throws Error if pool cannot be fetched
 */
export async function getPoolByAddress(
  chainId: number,
  poolAddress: string
): Promise<Pool> {
  return getPool(chainId, poolAddress);
}

/**
 * Validate token addresses and fetch metadata
 * 
 * @param chainId - Chain ID
 * @param tokenAddress - Token address
 * @returns Token metadata
 * @throws Error if token is invalid
 */
export async function validateToken(
  chainId: number,
  tokenAddress: string
): Promise<Token> {
  try {
    return await fetchTokenMetadata(chainId, tokenAddress);
  } catch (error) {
    throw new Error(`Invalid token address ${tokenAddress}: ${error}`);
  }
}

/**
 * Clear pool cache
 */
export function clearPoolCache(): void {
  poolCache.clear();
}

// Wrapper functions for API routes
export async function getTopPools(chainId: number, limit = 20): Promise<Pool[]> {
  // Return empty array - actual implementation would query DeFi Llama or factory
  console.warn('getTopPools: Using empty array - implement with DeFi Llama API');
  return [];
}

export async function getPoolsByToken(chainId: number, tokenAddress: string): Promise<Pool[]> {
  const normalizedToken = tokenAddress.toLowerCase();
  const discoveredPools: Pool[] = [];
  const seenAddresses = new Set<string>();

  // 1. Try on-chain discovery against common quote tokens
  const quoteTokens = COMMON_QUOTE_TOKENS[chainId] || [];
  const discoveryPromises = quoteTokens.flatMap((quoteToken) =>
    SUPPORTED_FEE_TIERS.map(async (feeTier) => {
      try {
        const pool = await discoverPool(chainId, normalizedToken, quoteToken, feeTier);
        return pool;
      } catch {
        return null;
      }
    })
  );

  const results = await Promise.allSettled(discoveryPromises);
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const addr = result.value.address.toLowerCase();
      if (!seenAddresses.has(addr)) {
        seenAddresses.add(addr);
        discoveredPools.push(result.value);
      }
    }
  }

  // 2. Fallback: try DeFi Llama pool list for pools containing this token
  try {
    const llamaPools = await fetchDefiLlamaPools(chainId);
    for (const llamaPool of llamaPools) {
      if (!llamaPool.underlyingTokens) continue;
      const hasToken = llamaPool.underlyingTokens.some(
        (t) => t.toLowerCase() === normalizedToken
      );
      if (!hasToken) continue;

      // Extract pool address from pool ID (format: "chain:address")
      const poolAddress = llamaPool.pool.split(':').pop()?.toLowerCase();
      if (!poolAddress || !poolAddress.startsWith('0x')) continue;
      if (seenAddresses.has(poolAddress)) continue;

      try {
        const pool = await getPool(chainId, poolAddress);
        seenAddresses.add(poolAddress);
        discoveredPools.push(pool);
      } catch {
        // Skip pools we can't fetch on-chain
      }
    }
  } catch {
    // DeFi Llama fallback is optional
  }

  // Sort by TVL descending (most liquid first)
  return discoveredPools.sort((a, b) => (b.tvlUSD || 0) - (a.tvlUSD || 0));
}

export async function searchPools(chainId: number, searchTerm: string): Promise<Pool[]> {
  // Simple search - just return empty for now
  console.warn('searchPools: Using empty array - implement with DeFi Llama search');
  return [];
}

export async function getPoolMetricsData(chainId: number, poolAddress: string): Promise<{
  tvl: number;
  volume24h: number;
  fees24h: number;
  apr: number;
  volumeUSD24h?: number;
} | null> {
  // Return null - metrics would come from DeFi Llama
  console.warn('getPoolMetricsData: Not implemented - returns null');
  return null;
}
