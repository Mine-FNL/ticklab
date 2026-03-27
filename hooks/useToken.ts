/**
 * useToken Hook
 * 
 * Fetches and caches token metadata using RPC (free, no API key).
 */

import { useQuery } from '@tanstack/react-query';
import { Token } from '@/types';
import { fetchTokenMetadata } from '@/lib/data/rpc';

/**
 * Fetch token from RPC
 * @param chainId - Chain ID
 * @param address - Token address
 * @returns Token metadata
 */
async function fetchToken(chainId: number, address: string): Promise<Token> {
  return fetchTokenMetadata(chainId, address);
}

/**
 * Hook to fetch token metadata
 * @param chainId - Chain ID
 * @param address - Token address (null if not ready)
 * @returns Query result with token data
 */
export function useToken(chainId: number, address: string | null) {
  return useQuery({
    queryKey: ['token', chainId, address],
    queryFn: () => fetchToken(chainId, address!),
    enabled: !!address,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook to fetch multiple tokens
 * @param chainId - Chain ID
 * @param addresses - Array of token addresses
 * @returns Query result with token data map
 */
export function useTokens(chainId: number, addresses: string[]) {
  return useQuery({
    queryKey: ['tokens', chainId, addresses],
    queryFn: async () => {
      const tokens = await Promise.all(
        addresses.map((addr) => fetchToken(chainId, addr))
      );
      return tokens.reduce((acc, token) => {
        acc[token.address.toLowerCase()] = token;
        return acc;
      }, {} as Record<string, Token>);
    },
    enabled: addresses.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}
