/**
 * Caching Layer
 * 
 * This module provides an in-memory caching layer with TTL support.
 * In production, this can be replaced with Redis.
 */

import { CACHE_TTL } from '@/lib/constants';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// In-memory cache store
const cacheStore: Map<string, CacheEntry<unknown>> = new Map();

/**
 * Get a value from the cache
 * @param key - Cache key
 * @returns Cached value or undefined
 */
export function cacheGet<T>(key: string): T | undefined {
  const entry = cacheStore.get(key);
  
  if (!entry) {
    return undefined;
  }
  
  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return undefined;
  }
  
  return entry.value as T;
}

/**
 * Set a value in the cache
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttlMs - Time to live in milliseconds
 */
export function cacheSet<T>(
  key: string,
  value: T,
  ttlMs: number
): void {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Delete a value from the cache
 * @param key - Cache key
 */
export function cacheDelete(key: string): void {
  cacheStore.delete(key);
}

/**
 * Clear all cached values
 */
export function cacheClear(): void {
  cacheStore.clear();
}

/**
 * Get cache keys matching a pattern
 * @param pattern - String pattern to match
 * @returns Array of matching keys
 */
export function cacheKeys(pattern?: string): string[] {
  const keys = Array.from(cacheStore.keys());
  
  if (!pattern) {
    return keys;
  }
  
  return keys.filter((key) => key.includes(pattern));
}

/**
 * Get cache statistics
 * @returns Cache stats
 */
export function cacheStats(): {
  size: number;
  hitRate: number;
  missRate: number;
} {
  return {
    size: cacheStore.size,
    hitRate: 0, // Would need to track hits/misses
    missRate: 0,
  };
}

// Cache key generators

/**
 * Generate cache key for token metadata
 */
export function getTokenCacheKey(chainId: number, address: string): string {
  return `token:${chainId}:${address.toLowerCase()}`;
}

/**
 * Generate cache key for pool metadata
 */
export function getPoolCacheKey(chainId: number, address: string): string {
  return `pool:${chainId}:${address.toLowerCase()}`;
}

/**
 * Generate cache key for pool state
 */
export function getPoolStateCacheKey(chainId: number, address: string): string {
  return `pool-state:${chainId}:${address.toLowerCase()}`;
}

/**
 * Generate cache key for position data
 */
export function getPositionCacheKey(
  chainId: number,
  positionId: string
): string {
  return `position:${chainId}:${positionId}`;
}

/**
 * Generate cache key for historical data
 */
export function getHistoricalCacheKey(
  chainId: number,
  poolAddress: string,
  startTime: number,
  endTime: number
): string {
  return `historical:${chainId}:${poolAddress.toLowerCase()}:${startTime}:${endTime}`;
}

/**
 * Generate cache key for simulation results
 */
export function getSimulationCacheKey(
  poolAddress: string,
  paramsHash: string
): string {
  return `simulation:${poolAddress.toLowerCase()}:${paramsHash}`;
}

/**
 * Generate cache key for backtest results
 */
export function getBacktestCacheKey(
  poolAddress: string,
  startDate: string,
  endDate: string,
  paramsHash: string
): string {
  return `backtest:${poolAddress.toLowerCase()}:${startDate}:${endDate}:${paramsHash}`;
}

// Cached fetch wrappers

/**
 * Fetch with caching
 * @param key - Cache key
 * @param fetchFn - Function to fetch data
 * @param ttlMs - Time to live
 * @returns Fetched or cached data
 */
export async function fetchWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  // Try to get from cache
  const cached = cacheGet<T>(key);
  if (cached !== undefined) {
    return cached;
  }
  
  // Fetch fresh data
  const data = await fetchFn();
  
  // Cache the result
  cacheSet(key, data, ttlMs);
  
  return data;
}

/**
 * Memoize a function with cache
 * @param fn - Function to memoize
 * @param keyFn - Function to generate cache key from arguments
 * @param ttlMs - Time to live
 * @returns Memoized function
 */
export function memoizeWithCache<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  keyFn: (...args: TArgs) => string,
  ttlMs: number
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyFn(...args);
    return fetchWithCache(key, () => fn(...args), ttlMs);
  };
}

// Predefined cached fetchers

import { fetchTokenMetadata, fetchPoolState } from './rpc';
import { queryPoolsByToken, queryPool, queryPoolDayData } from './subgraph';

/**
 * Cached token metadata fetch
 */
export const cachedFetchTokenMetadata = memoizeWithCache(
  fetchTokenMetadata,
  (chainId, address) => getTokenCacheKey(chainId, address),
  CACHE_TTL.TOKEN_METADATA
);

/**
 * Cached pool state fetch
 */
export const cachedFetchPoolState = memoizeWithCache(
  fetchPoolState,
  (chainId, address) => getPoolStateCacheKey(chainId, address),
  CACHE_TTL.POOL_STATE
);

/**
 * Cached pools by token query
 */
export const cachedQueryPoolsByToken = memoizeWithCache(
  queryPoolsByToken,
  (chainId, tokenAddress) => `pools-by-token:${chainId}:${tokenAddress.toLowerCase()}`,
  CACHE_TTL.POOL_METADATA
);

/**
 * Cached pool query
 */
export const cachedQueryPool = memoizeWithCache(
  queryPool,
  (chainId, address) => getPoolCacheKey(chainId, address),
  CACHE_TTL.POOL_METADATA
);

/**
 * Cached pool day data query
 */
export const cachedQueryPoolDayData = memoizeWithCache(
  queryPoolDayData,
  (chainId, poolAddress, startTime, endTime) =>
    getHistoricalCacheKey(chainId, poolAddress, startTime, endTime),
  CACHE_TTL.HISTORICAL_DATA
);
