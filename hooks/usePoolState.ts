/**
 * usePoolState Hook
 * 
 * Fetches and caches current pool state with auto-refresh.
 */

import { useQuery } from '@tanstack/react-query';
import { PoolState } from '@/types';
import { fetchPoolState } from '@/lib/data/rpc';

/**
 * Hook to fetch current pool state
 * @param chainId - Chain ID
 * @param poolAddress - Pool address (null if not ready)
 * @param refetchInterval - Refetch interval in milliseconds
 * @returns Query result with pool state
 */
export function usePoolState(
  chainId: number,
  poolAddress: string | null,
  refetchInterval: number = 30000 // 30 seconds default
) {
  return useQuery({
    queryKey: ['pool-state', chainId, poolAddress],
    queryFn: () => fetchPoolState(chainId, poolAddress!),
    enabled: !!poolAddress,
    staleTime: 10000, // 10 seconds
    gcTime: 60000, // 1 minute
    refetchInterval,
    refetchIntervalInBackground: false,
    retry: 2,
  });
}

/**
 * Hook to fetch pool state without auto-refresh
 * @param chainId - Chain ID
 * @param poolAddress - Pool address (null if not ready)
 * @returns Query result with pool state
 */
export function usePoolStateStatic(chainId: number, poolAddress: string | null) {
  return usePoolState(chainId, poolAddress, 0);
}
