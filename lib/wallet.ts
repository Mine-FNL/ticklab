/**
 * Wallet Connection & Position Fetching
 * 
 * Uses viem for blockchain reads + wagmi for wallet connection.
 * Integrates with existing @rainbow-me/rainbowkit setup.
 */

import { createPublicClient, http, getAddress } from 'viem'
import { mainnet, arbitrum, base, optimism, polygon } from 'viem/chains'

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT ADDRESSES
// ─────────────────────────────────────────────────────────────────────────────

export const POSITION_MANAGER_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',     // Ethereum
  42161: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',  // Arbitrum
  8453: '0x03a520b32C04BF3bEEf7BEb72e919a822b4CB441',  // Base (corrected)
  10: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',    // Optimism
  137: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',    // Polygon
}

// ─────────────────────────────────────────────────────────────────────────────
// ABIS
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_NFT_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'positions',
    outputs: [{
      components: [
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
      internalType: 'struct Position.Info',
      type: 'tuple',
    }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const ERC20_ABI = [
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface LPPosition {
  tokenId: bigint
  token0: string
  token1: string
  feeTier: number
  tickLower: number
  tickUpper: number
  liquidity: bigint
  tokensOwed0: bigint  // unclaimed fees
  tokensOwed1: bigint
  // Resolved metadata
  symbol0?: string
  symbol1?: string
  decimals0?: number
  decimals1?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getChain(chainId: number) {
  switch (chainId) {
    case 1: return mainnet
    case 42161: return arbitrum
    case 8453: return base
    case 10: return optimism
    case 137: return polygon
    default: return mainnet
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch user's LP positions from Position Manager
 */
export async function fetchUserPositions(
  address: `0x${string}`,
  chainId: number
): Promise<LPPosition[]> {
  const chain = getChain(chainId)
  const client = createPublicClient({
    chain,
    transport: http(),
  })
  
  const positionManager = POSITION_MANAGER_ADDRESSES[chainId]
  if (!positionManager) {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
  
  // Get number of positions
  const balance = await client.readContract({
    address: positionManager,
    abi: POSITION_NFT_ABI,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint
  
  if (balance === 0n) {
    return []
  }
  
  // Fetch each position
  const positions: LPPosition[] = []
  
  for (let i = 0; i < Number(balance); i++) {
    const tokenId = await client.readContract({
      address: positionManager,
      abi: POSITION_NFT_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address, BigInt(i)],
    }) as bigint
    
    const position = await client.readContract({
      address: positionManager,
      abi: POSITION_NFT_ABI,
      functionName: 'positions',
      args: [tokenId],
    }) as {
      token0: string
      token1: string
      fee: number
      tickLower: number
      tickUpper: number
      liquidity: bigint
      tokensOwed0: bigint
      tokensOwed1: bigint
    }
    
    // Fetch token metadata
    const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
      client.readContract({ address: position.token0 as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }) as Promise<string>,
      client.readContract({ address: position.token1 as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }) as Promise<string>,
      client.readContract({ address: position.token0 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
      client.readContract({ address: position.token1 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
    ])
    
    positions.push({
      tokenId,
      token0: position.token0,
      token1: position.token1,
      feeTier: position.fee,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      liquidity: position.liquidity,
      tokensOwed0: position.tokensOwed0,
      tokensOwed1: position.tokensOwed1,
      symbol0,
      symbol1,
      decimals0,
      decimals1,
    })
  }
  
  return positions
}

/**
 * Check if a position is in range given current tick
 */
export function isPositionInRange(
  currentTick: number,
  tickLower: number,
  tickUpper: number
): boolean {
  return currentTick >= tickLower && currentTick <= tickUpper
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  symbol: string,
  decimalsToShow: number = 4
): string {
  const formatted = Number(amount) / Math.pow(10, decimals)
  return `${formatted.toFixed(decimalsToShow)} ${symbol}`
}

/**
 * Calculate estimated USD value of unclaimed fees
 * (Requires price data - simplified version)
 */
export function formatUnclaimedFees(position: LPPosition): string {
  const parts: string[] = []
  
  if (position.tokensOwed0 > 0n && position.symbol0 && position.decimals0 !== undefined) {
    const amount0 = Number(position.tokensOwed0) / Math.pow(10, position.decimals0)
    parts.push(`${amount0.toFixed(4)} ${position.symbol0}`)
  }
  
  if (position.tokensOwed1 > 0n && position.symbol1 && position.decimals1 !== undefined) {
    const amount1 = Number(position.tokensOwed1) / Math.pow(10, position.decimals1)
    parts.push(`${amount1.toFixed(4)} ${position.symbol1}`)
  }
  
  return parts.length > 0 ? parts.join(' + ') : 'None'
}