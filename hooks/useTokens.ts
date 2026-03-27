/**
 * useTokens Hook - Universal ERC20 Token Resolution
 * 
 * Hooks for resolving ANY ERC20 token address to metadata.
 * NO predefined token lists - works with any valid token contract.
 */

import { useQuery } from '@tanstack/react-query';
import { 
  resolveToken, 
  resolveTokens, 
  calculateTokenPriceFromPool,
  isValidAddress,
  type ResolvedToken 
} from '@/lib/data/tokens';

/**
 * Hook to resolve a single token address
 * Works with ANY valid ERC20 token
 * 
 * @param chainId - Chain ID
 * @param tokenAddress - Token address (null if not ready)
 * @returns Query result with resolved token metadata
 */
export function useToken(
  chainId: number,
  tokenAddress: string | null
) {
  return useQuery<ResolvedToken, Error>({
    queryKey: ['token', chainId, tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) {
        throw new Error('Token address is required');
      }
      return resolveToken(chainId, tokenAddress);
    },
    enabled: !!tokenAddress && isValidAddress(tokenAddress),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - token metadata doesn't change
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to resolve multiple token addresses
 * 
 * @param chainId - Chain ID
 * @param tokenAddresses - Array of token addresses
 * @returns Query result with array of resolved tokens
 */
export function useTokens(
  chainId: number,
  tokenAddresses: string[]
) {
  return useQuery<ResolvedToken[], Error>({
    queryKey: ['tokens', chainId, tokenAddresses],
    queryFn: async () => {
      if (!tokenAddresses.length) {
        throw new Error('At least one token address is required');
      }
      return resolveTokens(chainId, tokenAddresses);
    },
    enabled: tokenAddresses.length > 0 && tokenAddresses.every(isValidAddress),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to get token price from pool
 * Fallback when CoinGecko doesn't have the token
 * 
 * @param chainId - Chain ID
 * @param tokenAddress - Token address (null if not ready)
 * @param quoteTokenAddress - Quote token address (null if not ready)
 * @returns Query result with price
 */
export function useTokenPriceFromPool(
  chainId: number,
  tokenAddress: string | null,
  quoteTokenAddress: string | null
) {
  return useQuery<number, Error>({
    queryKey: ['token-price-pool', chainId, tokenAddress, quoteTokenAddress],
    queryFn: async () => {
      if (!tokenAddress || !quoteTokenAddress) {
        throw new Error('Both token addresses are required');
      }
      const price = await calculateTokenPriceFromPool(chainId, tokenAddress, quoteTokenAddress);
      if (price === undefined) {
        throw new Error('Could not calculate price from pool');
      }
      return price;
    },
    enabled: !!tokenAddress && !!quoteTokenAddress,
    staleTime: 30 * 1000, // 30 seconds - prices change frequently
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook to validate token address format
 * Quick check without full resolution
 * 
 * @param tokenAddress - Token address to validate
 * @returns Boolean indicating if address format is valid
 */
export function useTokenValidation(tokenAddress: string | null): {
  isValid: boolean;
  isChecking: boolean;
} {
  const isValid = !!tokenAddress && isValidAddress(tokenAddress);
  return {
    isValid,
    isChecking: false, // Instant validation
  };
}
