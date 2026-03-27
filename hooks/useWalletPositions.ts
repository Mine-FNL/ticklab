/**
 * useWalletPositions Hook
 * 
 * Fetches and manages wallet positions.
 */

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { ImportedPosition, PositionValue } from '@/types';
import { fetchUserPositions } from '@/lib/data/rpc';

/**
 * Fetch wallet positions from API
 * @param chainId - Chain ID
 * @param address - Wallet address
 * @returns Positions array
 */
async function fetchWalletPositions(
  chainId: number,
  address: string
): Promise<ImportedPosition[]> {
  const response = await fetch(
    `/api/wallet/positions?chainId=${chainId}&address=${address}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch wallet positions');
  }
  
  const data = await response.json();
  return data.positions;
}

/**
 * Hook to fetch wallet positions
 * @param chainId - Chain ID
 * @param address - Wallet address (null if not connected)
 * @returns Query result with positions
 */
export function useWalletPositions(chainId: number, address: string | null) {
  return useQuery({
    queryKey: ['wallet-positions', chainId, address],
    queryFn: () => fetchWalletPositions(chainId, address!),
    enabled: !!address,
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60000, // 5 minutes
    refetchInterval: 60000, // Auto-refresh every minute
  });
}

/**
 * Hook to fetch positions for connected wallet
 * @param chainId - Chain ID
 * @returns Query result with positions
 */
export function useConnectedWalletPositions(chainId: number) {
  const { address } = useAccount();
  return useWalletPositions(chainId, address || null);
}

/**
 * Fetch position analytics
 * @param chainId - Chain ID
 * @param positionId - Position ID
 * @returns Position analytics
 */
async function fetchPositionAnalytics(
  chainId: number,
  positionId: string
): Promise<{
  position: ImportedPosition;
  currentValue: PositionValue;
  unclaimedFees: { token0: number; token1: number; usd: number };
}> {
  const response = await fetch(
    `/api/positions/${positionId}/analytics?chainId=${chainId}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch position analytics');
  }
  
  return response.json();
}

/**
 * Hook to fetch position analytics
 * @param chainId - Chain ID
 * @param positionId - Position ID (null if not selected)
 * @returns Query result with analytics
 */
export function usePositionAnalytics(
  chainId: number,
  positionId: string | null
) {
  return useQuery({
    queryKey: ['position-analytics', chainId, positionId],
    queryFn: () => fetchPositionAnalytics(chainId, positionId!),
    enabled: !!positionId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch all positions across multiple chains
 * @param chains - Array of chain IDs
 * @param address - Wallet address
 * @returns Query result with positions by chain
 */
export function useMultiChainPositions(
  chains: number[],
  address: string | null
) {
  return useQuery({
    queryKey: ['multi-chain-positions', chains, address],
    queryFn: async () => {
      const results = await Promise.all(
        chains.map(async (chainId) => {
          const positions = await fetchWalletPositions(chainId, address!);
          return { chainId, positions };
        })
      );
      
      return results.reduce((acc, { chainId, positions }) => {
        acc[chainId] = positions;
        return acc;
      }, {} as Record<number, ImportedPosition[]>);
    },
    enabled: !!address && chains.length > 0,
    staleTime: 60000,
  });
}
