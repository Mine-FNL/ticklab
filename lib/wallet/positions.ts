/**
 * Position Import Module
 * 
 * Handles importing Uniswap V3 positions from the NonfungiblePositionManager.
 * Provides utilities for position analysis and monitoring.
 */

import { readContract } from '@wagmi/core';
import { config } from './config';
import { Token, Pool } from '@/lib/store';

// ============================================================================
// Contract Addresses
// ============================================================================

export const UNISWAP_V3_ADDRESSES: Record<
  number,
  { positionManager: string; factory: string; quoter?: string }
> = {
  1: {
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  137: {
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  42161: {
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  10: {
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  8453: {
    positionManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  },
};

// ============================================================================
// ABIs
// ============================================================================

const POSITION_MANAGER_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'positions',
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const FACTORY_ABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    name: 'getPool',
    outputs: [{ name: 'pool', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const POOL_ABI = [
  {
    inputs: [],
    name: 'slot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'liquidity',
    outputs: [{ name: '', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeGrowthGlobal0X128',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeGrowthGlobal1X128',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ============================================================================
// Types
// ============================================================================

export interface PositionData {
  nonce: bigint;
  operator: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export interface ImportedPosition {
  id: string;
  chainId: number;
  tokenId: string;
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  tokensOwed0: string;
  tokensOwed1: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
  nonce: string;
  operator: string;
}

export interface PositionStatus {
  isInRange: boolean;
  currentTick: number;
  priceRange: {
    min: number;
    max: number;
  };
  currentPrice: number;
  distanceToLower: number;
  distanceToUpper: number;
  utilization: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch token information from blockchain
 */
async function fetchTokenInfo(
  chainId: number,
  address: string
): Promise<Token> {
  const checksummedAddress = address.toLowerCase() as `0x${string}`;
  
  try {
    const [name, symbol, decimals] = await Promise.all([
      readContract(config, {
        address: checksummedAddress,
        abi: ERC20_ABI,
        functionName: 'name',
        chainId,
      }),
      readContract(config, {
        address: checksummedAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
        chainId,
      }),
      readContract(config, {
        address: checksummedAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
        chainId,
      }),
    ]);

    return {
      address: address.toLowerCase(),
      chainId,
      decimals: Number(decimals),
      symbol,
      name,
    };
  } catch (error) {
    console.error('Failed to fetch token info:', error);
    throw new Error(`Failed to fetch token info for ${address}`);
  }
}

/**
 * Get pool address from factory
 */
async function getPoolAddress(
  chainId: number,
  token0: string,
  token1: string,
  fee: number
): Promise<string | null> {
  const factory = UNISWAP_V3_ADDRESSES[chainId]?.factory;
  
  if (!factory) {
    throw new Error(`No factory address for chain ${chainId}`);
  }

  try {
    const poolAddress = await readContract(config, {
      address: factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [
        token0.toLowerCase() as `0x${string}`,
        token1.toLowerCase() as `0x${string}`,
        fee,
      ],
      chainId,
    });

    // Check if pool exists (address is not zero)
    if (poolAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    return poolAddress.toLowerCase();
  } catch (error) {
    console.error('Failed to get pool address:', error);
    throw error;
  }
}

/**
 * Fetch pool information
 */
async function fetchPool(
  chainId: number,
  token0: string,
  token1: string,
  fee: number
): Promise<Pool> {
  const poolAddress = await getPoolAddress(chainId, token0, token1, fee);
  
  if (!poolAddress) {
    throw new Error('Pool does not exist');
  }

  const [token0Info, token1Info, slot0, liquidity] = await Promise.all([
    fetchTokenInfo(chainId, token0),
    fetchTokenInfo(chainId, token1),
    readContract(config, {
      address: poolAddress as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'slot0',
      chainId,
    }),
    readContract(config, {
      address: poolAddress as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'liquidity',
      chainId,
    }),
  ]);

  const tickSpacings: Record<number, number> = {
    100: 1,
    500: 10,
    3000: 60,
    10000: 200,
  };

  return {
    address: poolAddress,
    chainId,
    token0: token0Info,
    token1: token1Info,
    fee,
    tickSpacing: tickSpacings[fee] || 60,
    sqrtPriceX96: slot0[0].toString(),
    tick: Number(slot0[1]),
    liquidity: liquidity.toString(),
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Import positions from NonfungiblePositionManager
 * 
 * @param chainId - Chain ID
 * @param owner - Wallet address
 * @returns Array of imported positions
 */
export async function importPositions(
  chainId: number,
  owner: string
): Promise<ImportedPosition[]> {
  const positionManager = UNISWAP_V3_ADDRESSES[chainId]?.positionManager;
  
  if (!positionManager) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  try {
    // Get number of positions owned
    const balance = await readContract(config, {
      address: positionManager as `0x${string}`,
      abi: POSITION_MANAGER_ABI,
      functionName: 'balanceOf',
      args: [owner as `0x${string}`],
      chainId,
    });

    if (balance === BigInt(0)) {
      return [];
    }

    // Fetch each position
    const positions: ImportedPosition[] = [];
    
    for (let i = 0; i < Number(balance); i++) {
      try {
        const tokenId = await readContract(config, {
          address: positionManager as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'tokenOfOwnerByIndex',
          args: [owner as `0x${string}`, BigInt(i)],
          chainId,
        });

        const position = await readContract(config, {
          address: positionManager as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'positions',
          args: [tokenId],
          chainId,
        });

        // Fetch pool information
        const pool = await fetchPool(
          chainId,
          position[2],
          position[3],
          Number(position[4])
        );

        positions.push({
          id: `${chainId}-${tokenId.toString()}`,
          chainId,
          tokenId: tokenId.toString(),
          pool,
          tickLower: Number(position[5]),
          tickUpper: Number(position[6]),
          liquidity: position[7].toString(),
          feeGrowthInside0LastX128: position[8].toString(),
          feeGrowthInside1LastX128: position[9].toString(),
          tokensOwed0: position[10].toString(),
          tokensOwed1: position[11].toString(),
          nonce: position[0].toString(),
          operator: position[1],
        });
      } catch (error) {
        console.error(`Failed to fetch position ${i}:`, error);
        // Continue with next position
      }
    }

    return positions;
  } catch (error) {
    console.error('Failed to import positions:', error);
    throw new Error(`Failed to import positions: ${error}`);
  }
}

/**
 * Get position status (in range, price info, etc.)
 * 
 * @param position - Imported position
 * @returns Position status
 */
export function getPositionStatus(position: ImportedPosition): PositionStatus {
  const currentTick = position.pool.tick;
  const isInRange = currentTick >= position.tickLower && currentTick <= position.tickUpper;
  
  // Calculate price range
  const decimalDiff = position.pool.token1.decimals - position.pool.token0.decimals;
  const minPrice = 1.0001 ** position.tickLower * 10 ** decimalDiff;
  const maxPrice = 1.0001 ** position.tickUpper * 10 ** decimalDiff;
  
  // Current price from sqrtPriceX96
  const sqrtPriceX96 = BigInt(position.pool.sqrtPriceX96);
  const Q96 = BigInt(2) ** BigInt(96);
  const priceSquared = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
  const currentPrice = priceSquared * 10 ** decimalDiff;
  
  // Calculate distances
  const distanceToLower = Math.abs(currentTick - position.tickLower);
  const distanceToUpper = Math.abs(position.tickUpper - currentTick);
  const totalRange = position.tickUpper - position.tickLower;
  
  // Utilization percentage (how much of the range is being used)
  const utilization = isInRange
    ? ((currentTick - position.tickLower) / totalRange) * 100
    : 0;

  return {
    isInRange,
    currentTick,
    priceRange: { min: minPrice, max: maxPrice },
    currentPrice,
    distanceToLower,
    distanceToUpper,
    utilization,
  };
}

/**
 * Calculate uncollected fees for a position
 * 
 * @param position - Imported position
 * @returns Estimated uncollected fees
 */
export function calculateUncollectedFees(
  position: ImportedPosition
): { token0: string; token1: string } {
  // This is a simplified calculation
  // In production, you'd need to fetch current fee growth and calculate the difference
  
  const owed0 = BigInt(position.tokensOwed0);
  const owed1 = BigInt(position.tokensOwed1);
  
  return {
    token0: (Number(owed0) / 10 ** position.pool.token0.decimals).toFixed(6),
    token1: (Number(owed1) / 10 ** position.pool.token1.decimals).toFixed(6),
  };
}

/**
 * Format position for display
 * 
 * @param position - Imported position
 * @returns Formatted string
 */
export function formatPosition(position: ImportedPosition): string {
  const status = getPositionStatus(position);
  const range = `${status.priceRange.min.toFixed(4)}-${status.priceRange.max.toFixed(4)}`;
  const rangeStatus = status.isInRange ? '✓ In Range' : '✗ Out of Range';
  
  return `${position.pool.token0.symbol}/${position.pool.token1.symbol} ${(position.pool.fee / 10000).toFixed(2)}% [${range}] ${rangeStatus}`;
}

/**
 * Check if a position needs rebalancing
 * 
 * @param position - Imported position
 * @param threshold - Distance threshold (in ticks)
 * @returns Whether rebalancing is recommended
 */
export function needsRebalancing(
  position: ImportedPosition,
  threshold: number = 100
): boolean {
  const status = getPositionStatus(position);
  
  if (!status.isInRange) {
    return true;
  }
  
  return status.distanceToLower < threshold || status.distanceToUpper < threshold;
}

export { fetchTokenInfo, getPoolAddress, fetchPool };
