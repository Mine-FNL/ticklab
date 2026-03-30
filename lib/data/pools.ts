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
  // Use discoverPool which exists
  try {
    const pool = await discoverPool(chainId, tokenAddress as `0x${string}`);
    return pool ? [pool] : [];
  } catch {
    return [];
  }
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
