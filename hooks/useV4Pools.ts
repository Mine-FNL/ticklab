/**
 * useV4Pools Hook
 * 
 * Hooks for discovering and fetching Uniswap V4 pool data.
 */

import { useQuery } from '@tanstack/react-query';
import { discoverV4Pools, discoverV4PoolsByToken, getV4Pool, V4Pool, V4PoolKey } from '@/lib/univ4/pool';
import { isValidAddress } from '@/lib/data/tokens';

/**
 * Hook to discover V4 pools for a token pair
 */
export function useV4PoolDiscovery(
  chainId: number,
  tokenA: string | null,
  tokenB: string | null,
  knownHookAddresses?: string[]
) {
  return useQuery<V4Pool[], Error>({
    queryKey: ['v4-pools-discovery', chainId, tokenA, tokenB, knownHookAddresses],
    queryFn: async () => {
      if (!tokenA || !tokenB) throw new Error('Both token addresses required');
      return discoverV4Pools(chainId, tokenA, tokenB, knownHookAddresses);
    },
    enabled: !!tokenA && !!tokenB && isValidAddress(tokenA) && isValidAddress(tokenB),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to discover V4 pools for a single token (against common quotes)
 */
export function useV4PoolsByToken(
  chainId: number,
  tokenAddress: string | null,
  knownHookAddresses?: string[]
) {
  return useQuery<V4Pool[], Error>({
    queryKey: ['v4-pools-by-token', chainId, tokenAddress, knownHookAddresses],
    queryFn: async () => {
      if (!tokenAddress) throw new Error('Token address required');
      return discoverV4PoolsByToken(chainId, tokenAddress, knownHookAddresses);
    },
    enabled: !!tokenAddress && isValidAddress(tokenAddress),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to fetch a specific V4 pool by pool key
 */
export function useV4Pool(
  chainId: number,
  poolKey: V4PoolKey | null
) {
  return useQuery<V4Pool | null, Error>({
    queryKey: ['v4-pool', chainId, poolKey],
    queryFn: async () => {
      if (!poolKey) throw new Error('Pool key required');
      return getV4Pool(chainId, poolKey);
    },
    enabled: !!poolKey,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}
