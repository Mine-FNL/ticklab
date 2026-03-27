/**
 * RPC Data Fetching
 * 
 * This module handles on-chain data fetching via RPC calls using viem.
 * Uses FREE public RPC endpoints - no API key required.
 */

import { createPublicClient, http, PublicClient, Address } from 'viem';
import { mainnet, arbitrum, base, optimism, polygon } from 'wagmi/chains';
import { Token, Pool, PoolState, Position } from '@/types';
import { 
  UNISWAP_V3_ADDRESSES, 
  PUBLIC_RPC_URLS,
  getPublicRpcUrl,
  ERC20_ABI, 
  POOL_ABI, 
  FACTORY_ABI,
  POSITION_MANAGER_ABI 
} from '@/lib/constants';

// Chain configuration mapping
const chainConfigs: Record<number, typeof mainnet> = {
  1: mainnet,
  42161: arbitrum,
  8453: base,
  10: optimism,
  137: polygon,
};

// Client cache with multiple endpoints per chain
const clientCache: Record<number, PublicClient[]> = {};

/**
 * Get public clients for a chain (multiple for failover)
 * @param chainId - Chain ID
 * @returns Array of public clients
 */
export function getPublicClients(chainId: number): PublicClient[] {
  if (!clientCache[chainId]) {
    const chain = chainConfigs[chainId];
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const rpcUrls = PUBLIC_RPC_URLS[chainId] || [getPublicRpcUrl(chainId)];
    
    clientCache[chainId] = rpcUrls.map(url => 
      createPublicClient({
        chain,
        transport: http(url, {
          timeout: 10000,
          retryCount: 2,
        }),
      }) as PublicClient
    );
  }

  return clientCache[chainId];
}

/**
 * Get a single public client (with random selection for load balancing)
 * @param chainId - Chain ID
 * @returns Public client
 */
export function getPublicClient(chainId: number): PublicClient {
  const clients = getPublicClients(chainId);
  // Return random client for simple load balancing
  return clients[Math.floor(Math.random() * clients.length)];
}

/**
 * Execute RPC call with retry and failover
 * @param chainId - Chain ID
 * @param fn - Function to execute
 * @returns Result
 */
async function executeWithFailover<T>(
  chainId: number,
  fn: (client: PublicClient) => Promise<T>
): Promise<T> {
  const clients = getPublicClients(chainId);
  const errors: Error[] = [];

  for (const client of clients) {
    try {
      return await fn(client);
    } catch (error) {
      errors.push(error as Error);
      // Continue to next client
    }
  }

  throw new Error(`All RPC endpoints failed: ${errors.map(e => e.message).join(', ')}`);
}

/**
 * Fetch token metadata from on-chain
 * @param chainId - Chain ID
 * @param address - Token address
 * @returns Token metadata
 */
export async function fetchTokenMetadata(
  chainId: number,
  address: string
): Promise<Token> {
  try {
    const [symbol, name, decimals] = await Promise.all([
      executeWithFailover(chainId, (client) =>
        client.readContract({
          address: address as Address,
          abi: ERC20_ABI,
          functionName: 'symbol',
        })
      ),
      executeWithFailover(chainId, (client) =>
        client.readContract({
          address: address as Address,
          abi: ERC20_ABI,
          functionName: 'name',
        })
      ),
      executeWithFailover(chainId, (client) =>
        client.readContract({
          address: address as Address,
          abi: ERC20_ABI,
          functionName: 'decimals',
        })
      ),
    ]);

    return {
      chainId,
      address: address.toLowerCase(),
      symbol: symbol as string,
      name: name as string,
      decimals: decimals as number,
      verified: true,
    };
  } catch (error) {
    throw new Error(`Failed to fetch token metadata: ${error}`);
  }
}

/**
 * Fetch pool state from on-chain
 * @param chainId - Chain ID
 * @param poolAddress - Pool address
 * @returns Pool state
 */
export async function fetchPoolState(
  chainId: number,
  poolAddress: string
): Promise<PoolState> {
  try {
    const [slot0, liquidity] = await Promise.all([
      executeWithFailover(chainId, (client) =>
        client.readContract({
          address: poolAddress as Address,
          abi: POOL_ABI,
          functionName: 'slot0',
        })
      ),
      executeWithFailover(chainId, (client) =>
        client.readContract({
          address: poolAddress as Address,
          abi: POOL_ABI,
          functionName: 'liquidity',
        })
      ),
    ]);

    const [sqrtPriceX96, tick] = slot0 as [bigint, number];

    // Calculate prices from sqrtPriceX96
    const price = Number(sqrtPriceX96) / 2 ** 96;
    const token1Price = price * price;
    const token0Price = 1 / token1Price;

    return {
      tick,
      sqrtPriceX96,
      liquidity,
      token0Price,
      token1Price,
    };
  } catch (error) {
    throw new Error(`Failed to fetch pool state: ${error}`);
  }
}

/**
 * Get pool address from factory
 * @param chainId - Chain ID
 * @param token0 - Token0 address
 * @param token1 - Token1 address
 * @param fee - Fee tier
 * @returns Pool address or null
 */
export async function getPoolFromFactory(
  chainId: number,
  token0: string,
  token1: string,
  fee: number
): Promise<string | null> {
  const factory = UNISWAP_V3_ADDRESSES[chainId]?.factory;
  if (!factory) {
    throw new Error(`No factory for chain ${chainId}`);
  }

  try {
    const poolAddress = await executeWithFailover(chainId, (client) =>
      client.readContract({
        address: factory as Address,
        abi: FACTORY_ABI,
        functionName: 'getPool',
        args: [token0 as Address, token1 as Address, fee],
      })
    );

    // Check if pool exists (address != zero address)
    if (poolAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    return poolAddress as string;
  } catch (error) {
    console.error('Failed to get pool from factory:', error);
    return null;
  }
}

/**
 * Fetch full pool data from on-chain
 * @param chainId - Chain ID
 * @param poolAddress - Pool address
 * @returns Pool data
 */
export async function fetchPoolData(
  chainId: number,
  poolAddress: string
): Promise<Pool | null> {
  try {
    const [token0, token1, fee, state] = await Promise.all([
      executeWithFailover(chainId, (client) =>
        client.readContract({
          address: poolAddress as Address,
          abi: POOL_ABI,
          functionName: 'token0',
        })
      ),
      executeWithFailover(chainId, (client) =>
        client.readContract({
          address: poolAddress as Address,
          abi: POOL_ABI,
          functionName: 'token1',
        })
      ),
      executeWithFailover(chainId, (client) =>
        client.readContract({
          address: poolAddress as Address,
          abi: POOL_ABI,
          functionName: 'fee',
        })
      ),
      fetchPoolState(chainId, poolAddress).catch(() => null),
    ]);

    // Fetch token metadata
    const [token0Data, token1Data] = await Promise.all([
      fetchTokenMetadata(chainId, token0 as string),
      fetchTokenMetadata(chainId, token1 as string),
    ]);

    return {
      chainId,
      address: poolAddress.toLowerCase(),
      token0: token0Data,
      token1: token1Data,
      feeTier: fee as number,
      tickSpacing: fee === 100 ? 1 : fee === 500 ? 10 : fee === 3000 ? 60 : 200,
      currentTick: state?.tick,
      currentSqrtPriceX96: state?.sqrtPriceX96.toString(),
      currentLiquidity: state?.liquidity.toString(),
    };
  } catch (error) {
    console.error('Failed to fetch pool data:', error);
    return null;
  }
}

/**
 * Fetch position data from on-chain
 * @param chainId - Chain ID
 * @param positionId - Position NFT token ID
 * @returns Position data
 */
export async function fetchPosition(
  chainId: number,
  positionId: string
): Promise<Position> {
  const positionManager = UNISWAP_V3_ADDRESSES[chainId]?.positionManager;

  if (!positionManager) {
    throw new Error(`No position manager for chain ${chainId}`);
  }

  try {
    const position = await executeWithFailover(chainId, (client) =>
      client.readContract({
        address: positionManager as Address,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positions',
        args: [BigInt(positionId)],
      })
    );

    const [
      ,
      ,
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      liquidity,
      ,
      ,
      tokensOwed0,
      tokensOwed1,
    ] = position as [
      bigint, // nonce
      string, // operator
      string, // token0
      string, // token1
      number, // fee
      number, // tickLower
      number, // tickUpper
      bigint, // liquidity
      bigint, // feeGrowthInside0LastX128
      bigint, // feeGrowthInside1LastX128
      bigint, // tokensOwed0
      bigint, // tokensOwed1
    ];

    // Get pool address from factory
    const poolAddress = await getPoolFromFactory(chainId, token0, token1, fee);

    // Fetch token metadata
    const [token0Data, token1Data] = await Promise.all([
      fetchTokenMetadata(chainId, token0),
      fetchTokenMetadata(chainId, token1),
    ]);

    return {
      id: positionId,
      chainId,
      pool: {
        chainId,
        address: poolAddress || '',
        token0: token0Data,
        token1: token1Data,
        feeTier: fee,
        tickSpacing: fee === 100 ? 1 : fee === 500 ? 10 : fee === 3000 ? 60 : 200,
      },
      tickLower,
      tickUpper,
      liquidity,
      tokensOwed0,
      tokensOwed1,
    };
  } catch (error) {
    throw new Error(`Failed to fetch position: ${error}`);
  }
}

/**
 * Fetch user's positions from on-chain
 * @param chainId - Chain ID
 * @param owner - Owner address
 * @returns Array of position IDs
 */
export async function fetchUserPositionIds(
  chainId: number,
  owner: string
): Promise<string[]> {
  const positionManager = UNISWAP_V3_ADDRESSES[chainId]?.positionManager;

  if (!positionManager) {
    throw new Error(`No position manager for chain ${chainId}`);
  }

  try {
    const balance = await executeWithFailover(chainId, (client) =>
      client.readContract({
        address: positionManager as Address,
        abi: POSITION_MANAGER_ABI,
        functionName: 'balanceOf',
        args: [owner as Address],
      })
    );

    const positionIds: string[] = [];
    for (let i = 0; i < Number(balance); i++) {
      const tokenId = await executeWithFailover(chainId, (client) =>
        client.readContract({
          address: positionManager as Address,
          abi: POSITION_MANAGER_ABI,
          functionName: 'tokenOfOwnerByIndex',
          args: [owner as Address, BigInt(i)],
        })
      );
      positionIds.push(tokenId.toString());
    }

    return positionIds;
  } catch (error) {
    throw new Error(`Failed to fetch user positions: ${error}`);
  }
}

/**
 * Fetch user's full positions
 * @param chainId - Chain ID
 * @param owner - Owner address
 * @returns Array of positions
 */
export async function fetchUserPositions(
  chainId: number,
  owner: string
): Promise<Position[]> {
  const positionIds = await fetchUserPositionIds(chainId, owner);
  const positions = await Promise.all(
    positionIds.map((id) => fetchPosition(chainId, id))
  );
  return positions;
}

/**
 * Check if an address is a valid ERC20 token
 * @param chainId - Chain ID
 * @param address - Address to check
 * @returns True if valid ERC20
 */
export async function isValidERC20(
  chainId: number,
  address: string
): Promise<boolean> {
  try {
    await executeWithFailover(chainId, (client) =>
      client.readContract({
        address: address as Address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch token balance
 * @param chainId - Chain ID
 * @param tokenAddress - Token address
 * @param owner - Owner address
 * @returns Token balance
 */
export async function fetchTokenBalance(
  chainId: number,
  tokenAddress: string,
  owner: string
): Promise<bigint> {
  try {
    const balance = await executeWithFailover(chainId, (client) =>
      client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [owner as Address],
      })
    );
    return balance as bigint;
  } catch (error) {
    throw new Error(`Failed to fetch token balance: ${error}`);
  }
}

/**
 * Fetch multiple token balances
 * @param chainId - Chain ID
 * @param tokens - Array of token addresses
 * @param owner - Owner address
 * @returns Array of balances
 */
export async function fetchTokenBalances(
  chainId: number,
  tokens: string[],
  owner: string
): Promise<Record<string, bigint>> {
  const balances: Record<string, bigint> = {};

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const balance = await fetchTokenBalance(chainId, token, owner);
        balances[token.toLowerCase()] = balance;
      } catch {
        balances[token.toLowerCase()] = 0n;
      }
    })
  );

  return balances;
}
