/**
 * Strategy Type Definitions
 * Core types for UniV3 Strategy Lab
 */

export interface Token {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  verified?: boolean;
}

export interface Pool {
  chainId: number;
  address: string;
  token0: Token;
  token1: Token;
  feeTier: number;
  tickSpacing: number;
  currentTick?: number;
  currentSqrtPriceX96?: string;
  currentLiquidity?: string;
  tvlUSD?: number;
  volumeUSD24h?: number;
  feesUSD24h?: number;
  apr?: number;
}

export interface Strategy {
  id: string;
  name: string;
  token0: Token;
  token1: Token;
  pool: Pool;
  lowerTick: number;
  upperTick: number;
  depositAmount: number;
  depositMode: 'balanced' | 'token0-heavy' | 'token1-heavy';
  horizonDays: number;
  rebalanceMode: 'none' | 'periodic' | 'threshold' | 'volatility';
  gasCostAssumption: number;
  createdAt: Date;
}

export interface DailySnapshot {
  date: Date;
  price: number;
  lpValue: number;
  hodlValue: number;
  fees: number;
  il: number;
  inRange: boolean;
  token0Amount: number;
  token1Amount: number;
}

export interface BacktestResult {
  strategy: Strategy;
  startDate: Date;
  endDate: Date;
  totalFees: number;
  totalIL: number;
  netReturn: number;
  hodlReturn: number;
  rebalanceCount: number;
  timeInRangePercent: number;
  dailyData: DailySnapshot[];
}
