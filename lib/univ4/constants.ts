/**
 * Uniswap V4 Constants
 * 
 * V4 uses a single PoolManager per chain.
 * Pools are identified by PoolKey: (currency0, currency1, fee, tickSpacing, hooks)
 * rather than a standalone contract address.
 */

import { mainnet, arbitrum, base, optimism, polygon, sepolia } from 'wagmi/chains';

// Supported chains for V4
export const V4_SUPPORTED_CHAINS = [
  { id: mainnet.id, name: 'Ethereum', chain: mainnet },
  { id: base.id, name: 'Base', chain: base },
  { id: arbitrum.id, name: 'Arbitrum', chain: arbitrum },
  { id: optimism.id, name: 'Optimism', chain: optimism },
  { id: sepolia.id, name: 'Sepolia', chain: sepolia },
];

// V4 PoolManager addresses ( deployed as of early 2025 )
export const V4_POOL_MANAGER_ADDRESSES: Record<number, string> = {
  [mainnet.id]: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  [base.id]: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  [arbitrum.id]: '0x360e68faccca8ca495c1b759fd9eee466db9fb32',
  [optimism.id]: '0x9a13f98cb987694c9f086b01f12555e0dfe8d4a8',
  [sepolia.id]: '0xE03A107BcC496Bd4DbB1D81650fc8F08965E4338',
};

// V4 PositionManager (ERC721-style positions)
export const V4_POSITION_MANAGER_ADDRESSES: Record<number, string> = {
  [mainnet.id]: '0x7C5f5a4c8E5C4e0c7a5c5e5e5e5e5e5e5e5e5e5e', // placeholder - update when known
  [base.id]: '0x7C5f5a4c8E5C4e0c7a5c5e5e5e5e5e5e5e5e5e5e',
};

// V4 fee tier to tick spacing (same as V3 for standard tiers)
export const V4_FEE_TIER_TO_TICK_SPACING: Record<number, number> = {
  100: 1,      // 0.01%
  500: 10,     // 0.05%
  3000: 60,    // 0.3%
  10000: 200,  // 1%
};

export const V4_SUPPORTED_FEE_TIERS = [100, 500, 3000, 10000] as const;

// V4 PoolManager ABI (minimal - for pool lookup and state)
export const V4_POOL_MANAGER_ABI = [
  {
    inputs: [
      { name: 'key', type: 'tuple', components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
      ]},
    ],
    name: 'getPool',
    outputs: [{ name: 'id', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'id', type: 'bytes32' },
    ],
    name: 'getSlot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint16' },
      { name: 'lpFee', type: 'uint24' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'id', type: 'bytes32' },
    ],
    name: 'getLiquidity',
    outputs: [{ name: 'liquidity', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// V4 StateView helper contract (simplifies reading pool state)
export const V4_STATE_VIEW_ADDRESSES: Record<number, string> = {
  [mainnet.id]: '0x0000000000000000000000000000000000000000', // placeholder
};

// V4 PositionManager ABI
export const V4_POSITION_MANAGER_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getPositionInfo',
    outputs: [
      { name: 'poolKey', type: 'tuple', components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
      ]},
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ETH sentinel address in V4 (used for native ETH instead of WETH in pool keys)
export const V4_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// Default hooks address = no hooks
export const V4_NO_HOOKS_ADDRESS = '0x0000000000000000000000000000000000000000';
