/**
 * Application Constants
 * 
 * This module contains all constant values used throughout the application.
 * All data sources are FREE - no API keys required.
 * NO HARDCODED POOLS - All pool discovery is done on-chain via factory contract.
 */

import { mainnet, arbitrum, base, optimism, polygon } from 'wagmi/chains';

// Supported chains configuration
export const SUPPORTED_CHAINS = [
  { id: mainnet.id, name: 'Ethereum', chain: mainnet },
  { id: arbitrum.id, name: 'Arbitrum', chain: arbitrum },
  { id: base.id, name: 'Base', chain: base },
  { id: optimism.id, name: 'Optimism', chain: optimism },
  { id: polygon.id, name: 'Polygon', chain: polygon },
];

// Chain ID to name mapping
export const CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [arbitrum.id]: 'Arbitrum',
  [base.id]: 'Base',
  [optimism.id]: 'Optimism',
  [polygon.id]: 'Polygon',
};

// FREE Public RPC Endpoints (no API key required)
export const PUBLIC_RPC_URLS: Record<number, string[]> = {
  [mainnet.id]: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
  ],
  [arbitrum.id]: [
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
    'https://arbitrum.llamarpc.com',
  ],
  [base.id]: [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.publicnode.com',
  ],
  [optimism.id]: [
    'https://mainnet.optimism.io',
    'https://optimism.llamarpc.com',
    'https://rpc.ankr.com/optimism',
  ],
  [polygon.id]: [
    'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon',
    'https://polygon.llamarpc.com',
  ],
};

// Get a random RPC URL for load balancing
export function getPublicRpcUrl(chainId: number): string {
  const urls = PUBLIC_RPC_URLS[chainId];
  if (!urls || urls.length === 0) {
    throw new Error(`No RPC URLs for chain ${chainId}`);
  }
  return urls[Math.floor(Math.random() * urls.length)];
}

// Uniswap V3 contract addresses
export const UNISWAP_V3_ADDRESSES: Record<number, {
  factory: string;
  positionManager: string;
  quoter: string;
  quoterV2: string;
}> = {
  [mainnet.id]: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    quoterV2: '0x61fFE014bA17989E743c5F6cB21bF969dc0b0B60',
  },
  [arbitrum.id]: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    quoterV2: '0x61fFE014bA17989E743c5F6cB21bF969dc0b0B60',
  },
  [base.id]: {
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    positionManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    quoterV2: '0x222cA98F00eD15B1fae10b61c285E7d48533c774',
  },
  [optimism.id]: {
    factory: '0x4A4e734057437Af293FEb3e074b795255BE0D3e9',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    quoterV2: '0x61fFE014bA17989E743c5F6cB21bF969dc0b0B60',
  },
  [polygon.id]: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    quoterV2: '0x61fFE014bA17989E743c5F6cB21bF969dc0b0B60',
  },
};

// DeFi Llama API (FREE - no API key required)
export const DEFILLAMA_API = {
  BASE_URL: 'https://api.llama.fi',
  getPoolsUrl: (chain: string) => `https://api.llama.fi/pools/${chain}`,
  getPoolUrl: (poolId: string) => `https://api.llama.fi/pool/${poolId}`,
};

// Chain slug mapping for DeFi Llama
export const DEFILLAMA_CHAIN_SLUGS: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [arbitrum.id]: 'Arbitrum',
  [base.id]: 'Base',
  [optimism.id]: 'Optimism',
  [polygon.id]: 'Polygon',
};

// CoinGecko API (FREE - no API key required for basic usage)
export const COINGECKO_API = {
  BASE_URL: 'https://api.coingecko.com/api/v3',
  // Map chain IDs to CoinGecko platform IDs
  PLATFORM_IDS: {
    [mainnet.id]: 'ethereum',
    [arbitrum.id]: 'arbitrum-one',
    [base.id]: 'base',
    [optimism.id]: 'optimistic-ethereum',
    [polygon.id]: 'polygon-pos',
  } as Record<number, string>,
};

// Fee tier to tick spacing mapping
export const FEE_TIER_TO_TICK_SPACING: Record<number, number> = {
  100: 1,      // 0.01%
  500: 10,     // 0.05%
  3000: 60,    // 0.3%
  10000: 200,  // 1%
};

// Fee tier labels
export const FEE_TIER_LABELS: Record<number, string> = {
  100: '0.01%',
  500: '0.05%',
  3000: '0.3%',
  10000: '1%',
};

// All supported fee tiers for pool discovery
export const SUPPORTED_FEE_TIERS = [100, 500, 3000, 10000] as const;

// Default values
export const DEFAULTS = {
  CHAIN_ID: mainnet.id,
  GAS_GWEI: 20,
  HORIZON_DAYS: 30,
  SLIPPAGE_TOLERANCE: 0.005,
  DEADLINE_MINUTES: 20,
  REBALANCE_MODE: 'none' as const,
  VOLUME_SCENARIO: 'base' as const,
  DECIMAL_PLACES: 4,
  CURRENCY: 'USD',
  FEE_TIER: 3000,
};

// Cache TTLs (in milliseconds)
export const CACHE_TTL = {
  TOKEN_METADATA: 24 * 60 * 60 * 1000,      // 24 hours
  POOL_STATE: 30 * 1000,                     // 30 seconds
  POOL_METADATA: 60 * 60 * 1000,             // 1 hour
  POSITION_DATA: 60 * 1000,                  // 1 minute
  DEFILLAMA_DATA: 5 * 60 * 1000,             // 5 minutes
  COINGECKO_DATA: 5 * 60 * 1000,             // 5 minutes
};

// UI Constants
export const UI = {
  MAX_PRICE_RANGE_STEPS: 100,
  CHART_HEIGHT: 400,
  MOBILE_BREAKPOINT: 768,
  SIDEBAR_WIDTH: 280,
  HEADER_HEIGHT: 64,
};

// Simulation constants
export const SIMULATION = {
  MIN_HORIZON_DAYS: 1,
  MAX_HORIZON_DAYS: 365,
  DEFAULT_MONTE_CARLO_RUNS: 1000,
  MAX_MONTE_CARLO_RUNS: 10000,
  PRICE_RANGE_MIN: 0.1,
  PRICE_RANGE_MAX: 4.0,
  PRICE_RANGE_STEPS: 50,
};

// ERC20 ABI (minimal)
export const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
] as const;

// Uniswap V3 Factory ABI
export const FACTORY_ABI = [
  {
    inputs: [],
    name: 'feeAmountTickSpacing',
    outputs: [{ name: 'tickSpacing', type: 'int24' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    name: 'getPool',
    outputs: [{ name: 'pool', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Uniswap V3 Pool ABI
export const POOL_ABI = [
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
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'fee',
    outputs: [{ name: '', type: 'uint24' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Position Manager ABI
export const POSITION_MANAGER_ABI = [
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
