/**
 * usePools Hook - REAL On-Chain Data with Universal Token Support
 * 
 * Fetches pool data using factory contract queries.
 * Works with ANY valid ERC20 token addresses.
 * NO HARDCODED POOLS - All discovery is done on-chain.
 */

import { useQuery } from '@tanstack/react-query';
import { Pool } from '@/types';
import { discoverPool, findPool, getPoolByAddress } from '@/lib/data/pools';
import { resolveToken, isValidAddress } from '@/lib/data/tokens';

/**
 * Hook to discover a pool for a token pair
 * Queries the Uniswap V3 Factory contract on-chain
 * Works with ANY valid ERC20 token addresses
 * 
 * @param chainId - Chain ID
 * @param tokenA - First token address (null if not ready)
 * @param tokenB - Second token address (null if not ready)
 * @param feeTier - Fee tier (optional, will try all if not specified)
 * @returns Query result with pool data or null if pool doesn't exist
 */
export function usePoolDiscovery(
  chainId: number,
  tokenA: string | null,
  tokenB: string | null,
  feeTier?: number
) {
  return useQuery<Pool | null, Error>({
    queryKey: ['pool-discovery', chainId, tokenA, tokenB, feeTier],
    queryFn: async () => {
      if (!tokenA || !tokenB) return null;
      
      // Validate addresses
      if (!isValidAddress(tokenA) || !isValidAddress(tokenB)) {
        throw new Error('Invalid token address format');
      }
      
      return discoverPool(chainId, tokenA, tokenB, feeTier);
    },
    enabled: !!tokenA && !!tokenB && isValidAddress(tokenA) && isValidAddress(tokenB),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to find pool address from factory
 * Returns just the pool address without full data
 * 
 * @param chainId - Chain ID
 * @param tokenA - First token address (null if not ready)
 * @param tokenB - Second token address (null if not ready)
 * @param feeTier - Fee tier (default: 3000)
 * @returns Query result with pool address or null
 */
export function useFindPoolAddress(
  chainId: number,
  tokenA: string | null,
  tokenB: string | null,
  feeTier: number = 3000
) {
  return useQuery<string | null, Error>({
    queryKey: ['pool-address', chainId, tokenA, tokenB, feeTier],
    queryFn: async () => {
      if (!tokenA || !tokenB) return null;
      
      if (!isValidAddress(tokenA) || !isValidAddress(tokenB)) {
        throw new Error('Invalid token address format');
      }
      
      const { findPool } = await import('@/lib/data/pools');
      return findPool(chainId, tokenA, tokenB, feeTier);
    },
    enabled: !!tokenA && !!tokenB && isValidAddress(tokenA) && isValidAddress(tokenB),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to fetch pool by known address
 * 
 * @param chainId - Chain ID
 * @param poolAddress - Pool address (null if not ready)
 * @returns Query result with pool data
 */
export function usePoolByAddress(
  chainId: number,
  poolAddress: string | null
) {
  return useQuery<Pool, Error>({
    queryKey: ['pool', chainId, poolAddress],
    queryFn: async () => {
      if (!poolAddress) throw new Error('Pool address is required');
      return getPoolByAddress(chainId, poolAddress);
    },
    enabled: !!poolAddress,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook to fetch all pools for a specific token address
 * Searches against common quote tokens and DeFi Llama data
 * 
 * @param chainId - Chain ID
 * @param tokenAddress - Token contract address (null if not ready)
 * @returns Query result with array of pools
 */
export function useTokenPools(
  chainId: number,
  tokenAddress: string | null
) {
  return useQuery<Pool[], Error>({
    queryKey: ['token-pools', chainId, tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) throw new Error('Token address is required');
      const { getPoolsByToken } = await import('@/lib/data/pools');
      return getPoolsByToken(chainId, tokenAddress);
    },
    enabled: !!tokenAddress && isValidAddress(tokenAddress),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * @deprecated Use useToken from '@/hooks/useTokens' instead
 */
export function useTokenValidation(
  chainId: number,
  tokenAddress: string | null
) {
  return useQuery({
    queryKey: ['token-validation', chainId, tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) throw new Error('Token address is required');
      return resolveToken(chainId, tokenAddress);
    },
    enabled: !!tokenAddress && isValidAddress(tokenAddress),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
