/**
 * Central Type Definitions for UniV3 Strategy Lab
 * Re-exports all types from sub-modules and defines shared types.
 */

export * from './strategy';

import type { Token, Pool } from './strategy';

// ============================================================================
// Pool Types
// ============================================================================

export interface PoolMetrics {
  tvlUSD: number;
  volumeUSD24h?: number;
  feesUSD24h?: number;
  apr?: number;
}

export interface PoolSnapshot {
  timestamp: number;
  blockNumber: number;
  tick: number;
  sqrtPriceX96: string;
  liquidity: string;
  token0Price: number;
  token1Price: number;
  volumeUSD24h: number;
  feesUSD24h: number;
  tvlUSD: number;
  dataConfidence: number;
}

export interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  token0Price: number;
  token1Price: number;
  observationIndex?: number;
  observationCardinality?: number;
  feeProtocol?: number;
}

// ============================================================================
// Position Types
// ============================================================================

export interface Position {
  id?: string;
  chainId?: number;
  pool?: Pool;
  nonce?: bigint;
  operator?: string;
  token0?: string | Token;
  token1?: string | Token;
  fee?: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0?: bigint;
  tokensOwed1?: bigint;
  feeGrowthInside0LastX128?: bigint;
  feeGrowthInside1LastX128?: bigint;
}

export interface ImportedPosition {
  id: string;
  chainId: number;
  tokenId: string;
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  nonce: bigint;
  operator: string;
}

export interface PositionValue {
  totalValueUSD: number;
  token0Amount: number;
  token1Amount: number;
  usd?: number;
  token0?: number;
  token1?: number;
  feesToken0?: number;
  feesToken1?: number;
  feesUSD?: number;
}

// ============================================================================
// Fee Estimation Types
// ============================================================================

export interface FeeEstimateParams {
  dailyVolumeUSD: number;
  volumeScenario: 'low' | 'base' | 'high' | 'custom';
  customVolumeMultiplier?: number;
  feeTier: number;
  positionLiquidity: bigint;
  activeLiquidityInRange: bigint;
  currentLiquidity?: string | bigint;
  timeInRange: number;
  horizonDays: number;
}

export interface FeeEstimateResult {
  min: number;
  base: number;
  max: number;
  feesUSD?: number;
  confidenceInterval: [number, number];
}

export type FeeEstimate = FeeEstimateResult;

// ============================================================================
// IL Calculation Types
// ============================================================================

export interface ILCalculationParams {
  entryPrice: number;
  exitPrice: number;
  lowerPrice: number;
  upperPrice: number;
  depositAmount: number;
  depositToken: 'token0' | 'token1' | 'usd';
  token0Decimals: number;
  token1Decimals: number;
}

export interface ILResult {
  lpValue: number;
  hodlValue: number;
  divergenceLoss: number;
  divergenceLossPercent: number;
  token0Amount: number;
  token1Amount: number;
  inRange: boolean;
  belowRange: boolean;
  aboveRange: boolean;
}

// ============================================================================
// Position Entry Types
// ============================================================================

export interface PositionEntryParams {
  depositAmount: number;
  depositToken: 'token0' | 'token1' | 'usd';
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
  token0Decimals: number;
  token1Decimals: number;
}

export interface PositionEntryResult {
  token0Amount: number;
  token1Amount: number;
  liquidity: bigint;
  valueUSD: number;
}

// ============================================================================
// Simulation Types
// ============================================================================

export interface ScenarioPoint {
  exitPrice: number;
  priceChangePercent: number;
  lpValue: number;
  hodlValue: number;
  feesEarned: number;
  gasCosts: number;
  netReturn: number;
  excessReturnVsHODL: number;
  divergenceLoss: number;
  token0Amount: number;
  token1Amount: number;
  inRange: boolean;
}

export interface SimulationRequest {
  poolAddress: string;
  chainId: number;
  depositAmount: string;
  depositToken: 'token0' | 'token1' | 'usd';
  lowerTick: number;
  upperTick: number;
  horizonDays: number;
  dailyVolumeUSD: number;
  feeTier: number;
  currentLiquidity: string;
  currentPrice: number;
  token0Decimals: number;
  token1Decimals: number;
  gasCostGwei: number;
  volumeScenario?: 'low' | 'base' | 'high' | 'custom';
  customVolumeMultiplier?: number;
}

export interface SimulationResult {
  scenarioGrid?: ScenarioPoint[];
  feeEstimates?: FeeEstimateResult;
  summary?: {
    estimatedFeesMin: number;
    estimatedFeesMax: number;
    estimatedIL: number;
    netReturnVsHODL: number;
    timeInRange: number;
  };
}

// ============================================================================
// Backtest Types
// ============================================================================

export interface BacktestParams {
  poolAddress: string;
  chainId: number;
  depositAmount: string;
  depositToken: 'token0' | 'token1' | 'usd';
  lowerTick: number;
  upperTick: number;
  startDate: string;
  endDate: string;
  rebalanceMode: 'none' | 'periodic' | 'threshold' | 'volatility';
  rebalanceParams?: {
    periodDays?: number;
    priceThreshold?: number;
    volatilityThreshold?: number;
  };
  gasCostGwei: number;
}

// ============================================================================
// Strategy & User Types
// ============================================================================

export interface SavedStrategy {
  id: string;
  name: string;
  pool: {
    address: string;
    chainId: number;
    token0: Token;
    token1: Token;
    fee: number;
    token0Decimals?: number;
    token1Decimals?: number;
  };
  depositAmount: string;
  depositToken: 'token0' | 'token1' | 'usd';
  lowerTick: number;
  upperTick: number;
  horizonDays: number;
  rebalanceMode: 'none' | 'periodic' | 'threshold' | 'volatility';
  gasCostGwei: number;
  createdAt: string;
  simulation?: SimulationResult;
  backtest?: unknown;
}

export interface UserSettings {
  defaultChainId: number;
  currency: string;
  chartTheme: string;
  decimalPlaces: number;
  defaultGasGwei: number;
  defaultHorizon: number;
}

// ============================================================================
// UI / Warning Types
// ============================================================================

export interface DataWarning {
  type: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source?: string;
  timestamp?: Date;
  recommendation?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
