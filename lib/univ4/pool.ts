/**
 * Uniswap V4 Pool Discovery & State Reading
 * 
 * V4 pools are identified by PoolKey (currency0, currency1, fee, tickSpacing, hooks)
 * rather than standalone addresses. The PoolManager contract maintains the state.
 * 
 * This module provides:
 * - Pool key hashing and identification
 * - Pool state reading via PoolManager
 * - Discovery of V4 pools for a given token pair
 */

import { Address, createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { mainnet, arbitrum, base, optimism, polygon } from 'wagmi/chains';
import { Token, Pool } from '@/types';
import { 
  V4_POOL_MANAGER_ADDRESSES, 
  V4_POOL_MANAGER_ABI,
  V4_SUPPORTED_FEE_TIERS,
  V4_FEE_TIER_TO_TICK_SPACING,
  V4_NO_HOOKS_ADDRESS,
  V4_ETH_ADDRESS,
} from './constants';
import { fetchTokenMetadata } from '@/lib/data/rpc';
import { executeWithFailover } from '@/lib/data/rpc';
import { getPublicClients } from '@/lib/data/rpc';
import { PUBLIC_RPC_URLS } from '@/lib/constants';

const chainConfigs = {
  1: mainnet,
  42161: arbitrum,
  8453: base,
  10: optimism,
  137: polygon,
};

// ============================================================================
// Types
// ============================================================================

export interface V4PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

export interface V4PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
  liquidity: bigint;
}

export interface V4Pool extends Pool {
  poolId: string;           // bytes32 keccak256(poolKey)
  poolKey: V4PoolKey;
  hookAddress?: string;
  hookName?: string;
  isV4: true;
}

// ============================================================================
// Pool Key Hashing
// ============================================================================

/**
 * Hash a V4 pool key to get the pool ID (bytes32).
 * Matches the Solidity: keccak256(abi.encode(poolKey))
 */
export function hashPoolKey(key: V4PoolKey): string {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [
      key.currency0 as `0x${string}`,
      key.currency1 as `0x${string}`,
      key.fee,
      key.tickSpacing,
      key.hooks as `0x${string}`,
    ]
  );
  return keccak256(encoded);
}

/**
 * Sort currencies for V4 pool key.
 * V4 requires currency0 < currency1 (address ordering).
 */
export function sortCurrencies(currencyA: string, currencyB: string): [string, string] {
  const a = currencyA.toLowerCase();
  const b = currencyB.toLowerCase();
  return a < b ? [a, b] : [b, a];
}

// ============================================================================
// Pool State Reading
// ============================================================================

function getV4PublicClient(chainId: number) {
  const chain = chainConfigs[chainId as keyof typeof chainConfigs];
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  
  const rpcUrl = PUBLIC_RPC_URLS[chainId]?.[0];
  return createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 10000 }),
  });
}

/**
 * Fetch V4 pool state from PoolManager.
 * Uses getSlot0 and getLiquidity.
 */
export async function fetchV4PoolState(
  chainId: number,
  poolId: string
): Promise<V4PoolState> {
  const manager = V4_POOL_MANAGER_ADDRESSES[chainId];
  if (!manager) throw new Error(`No V4 PoolManager for chain ${chainId}`);

  const client = getV4PublicClient(chainId);

  const [slot0, liquidity] = await Promise.all([
    client.readContract({
      address: manager as `0x${string}`,
      abi: V4_POOL_MANAGER_ABI,
      functionName: 'getSlot0',
      args: [poolId as `0x${string}`],
    }).catch(() => null),
    client.readContract({
      address: manager as `0x${string}`,
      abi: V4_POOL_MANAGER_ABI,
      functionName: 'getLiquidity',
      args: [poolId as `0x${string}`],
    }).catch(() => null),
  ]);

  if (!slot0) {
    throw new Error(`Pool ${poolId} not found on V4 PoolManager`);
  }

  const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0 as [bigint, number, number, number];

  return {
    sqrtPriceX96,
    tick,
    protocolFee,
    lpFee,
    liquidity: (liquidity as bigint) || 0n,
  };
}

/**
 * Check if a V4 pool exists by trying to read its slot0.
 */
export async function v4PoolExists(
  chainId: number,
  poolKey: V4PoolKey
): Promise<{ exists: boolean; poolId?: string; state?: V4PoolState }> {
  const poolId = hashPoolKey(poolKey);
  
  try {
    const state = await fetchV4PoolState(chainId, poolId);
    return { exists: true, poolId, state };
  } catch {
    return { exists: false };
  }
}

// ============================================================================
// Pool Discovery
// ============================================================================

/**
 * Discover V4 pools for a token pair.
 * Tries all standard fee tiers + no-hooks and common hook addresses.
 */
export async function discoverV4Pools(
  chainId: number,
  tokenA: string,
  tokenB: string,
  knownHookAddresses?: string[]
): Promise<V4Pool[]> {
  const [currency0, currency1] = sortCurrencies(tokenA, tokenB);
  const pools: V4Pool[] = [];
  const seenIds = new Set<string>();

  // Hooks to try: no-hooks + any known hooks
  const hooksToTry = [V4_NO_HOOKS_ADDRESS];
  if (knownHookAddresses) {
    for (const h of knownHookAddresses) {
      if (!hooksToTry.includes(h.toLowerCase())) {
        hooksToTry.push(h.toLowerCase());
      }
    }
  }

  // Try all combinations
  const discoveryPromises = V4_SUPPORTED_FEE_TIERS.flatMap(fee => {
    const tickSpacing = V4_FEE_TIER_TO_TICK_SPACING[fee];
    return hooksToTry.map(async (hooks) => {
      const poolKey: V4PoolKey = { currency0, currency1, fee, tickSpacing, hooks };
      const { exists, poolId, state } = await v4PoolExists(chainId, poolKey);
      
      if (exists && poolId && state && !seenIds.has(poolId)) {
        seenIds.add(poolId);
        return { poolKey, poolId, state };
      }
      return null;
    });
  });

  const results = (await Promise.allSettled(discoveryPromises))
    .filter((r): r is PromiseFulfilledResult<{ poolKey: V4PoolKey; poolId: string; state: V4PoolState }> => 
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value);

  // Fetch token metadata for discovered pools
  for (const result of results) {
    try {
      const [token0Data, token1Data] = await Promise.all([
        fetchTokenMetadata(chainId, result.poolKey.currency0),
        fetchTokenMetadata(chainId, result.poolKey.currency1),
      ]);

      const sqrtPrice = Number(result.state.sqrtPriceX96) / 2 ** 96;
      const token1Price = sqrtPrice * sqrtPrice;

      pools.push({
        chainId,
        address: result.poolId, // In V4, poolId acts as the identifier
        token0: token0Data,
        token1: token1Data,
        feeTier: result.poolKey.fee,
        tickSpacing: result.poolKey.tickSpacing,
        currentTick: result.state.tick,
        currentSqrtPriceX96: result.state.sqrtPriceX96.toString(),
        currentLiquidity: result.state.liquidity.toString(),
        poolId: result.poolId,
        poolKey: result.poolKey,
        hookAddress: result.poolKey.hooks !== V4_NO_HOOKS_ADDRESS ? result.poolKey.hooks : undefined,
        isV4: true,
      });
    } catch {
      // Skip pools where token metadata fails
    }
  }

  return pools;
}

/**
 * Discover V4 pools for a single token (against common quote tokens).
 */
export async function discoverV4PoolsByToken(
  chainId: number,
  tokenAddress: string,
  knownHookAddresses?: string[]
): Promise<V4Pool[]> {
  const commonQuotes: Record<number, string[]> = {
    1: [
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
    ],
    8453: [
      '0x4200000000000000000000000000000000000006',
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      '0xfde4c96c8593536e31f229ea8f37b2ada2699b57',
    ],
    42161: [
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      '0xfd086bc7cd5c481dcc9c96ebe6a1a233e24197f0',
    ],
  };

  const quotes = commonQuotes[chainId] || [];
  const allPools: V4Pool[] = [];
  const seenIds = new Set<string>();

  for (const quote of quotes) {
    if (quote.toLowerCase() === tokenAddress.toLowerCase()) continue;
    try {
      const pools = await discoverV4Pools(chainId, tokenAddress, quote, knownHookAddresses);
      for (const pool of pools) {
        if (!seenIds.has(pool.poolId)) {
          seenIds.add(pool.poolId);
          allPools.push(pool);
        }
      }
    } catch {
      // Continue to next quote
    }
  }

  return allPools;
}

/**
 * Get a single V4 pool by its full pool key.
 */
export async function getV4Pool(
  chainId: number,
  poolKey: V4PoolKey
): Promise<V4Pool | null> {
  const { exists, poolId, state } = await v4PoolExists(chainId, poolKey);
  if (!exists || !poolId || !state) return null;

  const [token0Data, token1Data] = await Promise.all([
    fetchTokenMetadata(chainId, poolKey.currency0),
    fetchTokenMetadata(chainId, poolKey.currency1),
  ]);

  return {
    chainId,
    address: poolId,
    token0: token0Data,
    token1: token1Data,
    feeTier: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    currentTick: state.tick,
    currentSqrtPriceX96: state.sqrtPriceX96.toString(),
    currentLiquidity: state.liquidity.toString(),
    poolId,
    poolKey,
    hookAddress: poolKey.hooks !== V4_NO_HOOKS_ADDRESS ? poolKey.hooks : undefined,
    isV4: true,
  };
}
