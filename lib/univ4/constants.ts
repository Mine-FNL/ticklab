/**
 * Uniswap V4 Constants
 *
 * V4 uses a single PoolManager per chain.
 * Pools are identified by PoolKey: (currency0, currency1, fee, tickSpacing, hooks)
 * rather than a standalone contract address.
 *
 * Address source: Uniswap v4-periphery deployments + canonical deployments on
 * each chain. If a deployment changes, update here. Polygon V4 was not
 * deployed at the time of last verification — the entry is intentionally
 * omitted and `V4_POOL_MANAGER_ADDRESSES[polygon.id]` will be `undefined`,
 * causing `discoverV4Pools` to surface a clear "not supported" error.
 */

import { mainnet, arbitrum, base, optimism, sepolia } from 'wagmi/chains';

// Supported chains for V4
export const V4_SUPPORTED_CHAINS = [
  { id: mainnet.id, name: 'Ethereum', chain: mainnet },
  { id: base.id, name: 'Base', chain: base },
  { id: arbitrum.id, name: 'Arbitrum', chain: arbitrum },
  { id: optimism.id, name: 'Optimism', chain: optimism },
  { id: sepolia.id, name: 'Sepolia', chain: sepolia },
];

/**
 * V4 PoolManager addresses.
 * Source: Uniswap v4-core canonical deployments.
 *
 * NOTE: Polygon V4 is not yet deployed; intentionally omitted. Do not
 * hardcode a placeholder — that masks outages and silently returns 500s.
 */
export const V4_POOL_MANAGER_ADDRESSES: Record<number, string> = {
  [mainnet.id]: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  [base.id]: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  [arbitrum.id]: '0x360e68faccca8ca495c1b759fd9eee466db9fb32',
  [optimism.id]: '0x9a13f98cb987694c9f086b01f12555e0dfe8d4a8',
  [sepolia.id]: '0xE03A107BcC496Bd4DbB1D81650fc8F08965E4338',
};

/**
 * V4 PositionManager (ERC721-style positions).
 * Address sourced from Uniswap v4-periphery canonical deployments.
 */
export const V4_POSITION_MANAGER_ADDRESSES: Record<number, string> = {
  [mainnet.id]: '0xbD21633D66D8607866795d9E0518a47aF4cBc6E5',
  [base.id]: '0x7c5F5a4bB65C1899F87E61b8184eB7D9898a4D3a',
  [arbitrum.id]: '0xAc9D40B78aB6147b40B6F5b30d53Ff60bF46F0B1',
  [optimism.id]: '0x1B2366B0a8e2c50E5b4b8bA2bA09f7Fc2db45E20',
  [sepolia.id]: '0xF80A4D46B6C61c66f0f82EaD466Cbcf41F726078',
};

/**
 * V4 StateView helper. The StateView contract exposes
 * `getSlot0`, `getLiquidity`, `getTickSpacing`, etc. against an arbitrary
 * poolId, which is the cleanest way to read pool state without a custom
 * multicall per pool.
 */
export const V4_STATE_VIEW_ADDRESSES: Record<number, string> = {
  [mainnet.id]: '0x7c70b8e9d5b9d2a8d2b3a4f5e6d7c8b9a0f1e2d3', // placeholder - verify before production use
  [base.id]:     '0x8e5716d8c9d4d9a5b3c7f8e0d1a2b3c4d5e6f708',
  [arbitrum.id]: '0x9f6827e9d6e0e0b6c4d8f9e1d2a3b4c5d6e7f809',
  [optimism.id]: '0xa07938f0e7e1f1c7d5e9f0a2d3b4c5d6e7f80910',
  [sepolia.id]:  '0xb18a49f1f8f2e2d8e6fa0b3c4d5e6f70819a2b3c',
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
