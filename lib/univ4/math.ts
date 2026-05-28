/**
 * Uniswap V4 Math Engine
 * 
 * V4 uses the SAME tick math, price math, and liquidity formulas as V3.
 * The core AMM curve is unchanged. Hooks add behavior AROUND the swaps.
 * 
 * This module re-exports V3 math where identical, and adds V4-specific
 * calculations for hook-adjusted fees and returns.
 */

export {
  sqrtPriceX96ToPrice,
  priceToSqrtPriceX96,
  priceToTick,
  tickToPrice,
  tickToSqrtPriceX96,
  getNearestUsableTick,
  isValidTickLower,
  getLiquidityForAmounts,
  getAmountsForLiquidity,
} from '@/lib/univ3/math';

export {
  sqrtPriceToTick,
  tickToSqrtPrice,
  roundTickToFeeTier,
  getTokenAmountsFromLiquidity,
  getLiquidityFromTokenAmounts,
  getTokenCompositionAtPrice,
  getPositionValueAtPrice,
} from '@/lib/lp-math';

import {
  sqrtPriceX96ToPrice,
  tickToPrice,
  getLiquidityForAmounts,
  getAmountsForLiquidity,
} from '@/lib/univ3/math';

/**
 * Calculate effective fee rate considering hook adjustments.
 * V4 hooks can:
 * - Increase swap fees (fee override)
 * - Take a portion of fees (fee sharing)
 * - Add dynamic fees based on volatility, time, etc.
 * 
 * @param baseFeeTier - Base pool fee tier (e.g., 3000 for 0.3%)
 * @param hookFeeType - Type of hook fee adjustment
 * @param hookFeeBips - Additional fee in basis points (if applicable)
 * @returns Effective fee as decimal (e.g., 0.0035 for 0.35%)
 */
export function calculateEffectiveFeeRate(
  baseFeeTier: number,
  hookFeeType: 'none' | 'dynamic' | 'override' | 'share' | 'rebate',
  hookFeeBips: number = 0
): number {
  const baseRate = baseFeeTier / 1_000_000;

  switch (hookFeeType) {
    case 'none':
      return baseRate;
    case 'override':
      // Hook completely overrides the fee
      return hookFeeBips / 1_000_000;
    case 'dynamic':
      // Hook adds to base fee (e.g., volatility-based adjustment)
      return baseRate + (hookFeeBips / 1_000_000);
    case 'share':
      // Hook takes a share of the existing fee (LP gets less)
      // hookFeeBips here represents the percentage of fees the hook keeps
      return baseRate * (1 - hookFeeBips / 10_000);
    case 'rebate':
      // Hook returns some fees to LPs (LP gets more)
      return baseRate * (1 + hookFeeBips / 10_000);
    default:
      return baseRate;
  }
}

/**
 * Calculate LP returns with hook-adjusted fees.
 * 
 * @param params - Standard fee params plus hook adjustments
 */
export function calculateHookAdjustedLPReturn(params: {
  volume24h: number;
  baseFeeTier: number;
  yourLiquidity: bigint;
  poolLiquidity: bigint;
  timeInRange: number;
  horizonDays: number;
  hookFeeType: 'none' | 'dynamic' | 'override' | 'share';
  hookFeeBips: number;
  hookGasOverhead: number; // Extra gas per swap in USD
  estimatedSwapsPerDay: number;
}): {
  grossFeesUSD: number;
  hookShareUSD: number;
  netFeesUSD: number;
  gasOverheadUSD: number;
  effectiveAPR: number;
} {
  const effectiveFeeRate = calculateEffectiveFeeRate(
    params.baseFeeTier,
    params.hookFeeType,
    params.hookFeeBips
  );

  const liquidityRatio = Number(params.yourLiquidity) / Number(params.poolLiquidity || 1n);
  const dailyVolume = params.volume24h;
  const dailyGrossFees = dailyVolume * effectiveFeeRate * liquidityRatio * params.timeInRange;

  // Hook share calculation
  let hookShareUSD = 0;
  if (params.hookFeeType === 'share') {
    const totalHookShareRatio = params.hookFeeBips / 10_000;
    hookShareUSD = dailyVolume * (params.baseFeeTier / 1_000_000) * liquidityRatio * params.timeInRange * totalHookShareRatio;
  }

  const totalGasOverhead = params.hookGasOverhead * params.estimatedSwapsPerDay * params.horizonDays;
  const netFeesUSD = dailyGrossFees * params.horizonDays - hookShareUSD * params.horizonDays - totalGasOverhead;

  // Estimate APR (annualize)
  const positionValueUSD = 1000; // placeholder - caller should scale appropriately
  const effectiveAPR = positionValueUSD > 0 ? (netFeesUSD / positionValueUSD) * (365 / params.horizonDays) : 0;

  return {
    grossFeesUSD: dailyGrossFees * params.horizonDays,
    hookShareUSD: hookShareUSD * params.horizonDays,
    netFeesUSD,
    gasOverheadUSD: totalGasOverhead,
    effectiveAPR,
  };
}

/**
 * V4 position entry with hook considerations.
 * Some hooks require minimum position sizes, lockup periods,
 * or specific deposit ratios.
 */
export interface V4PositionEntryConstraints {
  minLiquidity?: bigint;
  lockupDays?: number;
  depositRatio?: 'balanced' | 'token0-only' | 'token1-only';
  requiresStaking?: boolean;
}

/**
 * Estimate the "flow capture" of a V4 position.
 * Flow = how much trading volume the position captures.
 * In V4 with hooks, flow can be redirected (e.g., MEV capture hooks,
 * order flow auctions, batch auctions).
 * 
 * @param totalVolume24h - Pool's total 24h volume
 * @param liquidityRatio - Your share of total liquidity
 * @param timeInRange - Probability price is in range
 * @param flowMultiplier - Hook-specific flow multiplier (e.g., OFA hooks might increase this)
 */
export function estimateFlowCapture(
  totalVolume24h: number,
  liquidityRatio: number,
  timeInRange: number,
  flowMultiplier: number = 1.0
): number {
  return totalVolume24h * liquidityRatio * timeInRange * flowMultiplier;
}

/**
 * Calculate expected tick range width for V4.
 * V4 allows custom tick spacings (including sub-1), so range
 * selection can be more granular than V3.
 */
export function calculateV4OptimalRange(
  currentPrice: number,
  volatility: number, // annualized
  confidence: number = 0.95,
  customTickSpacing?: number
): { lowerPrice: number; upperPrice: number; tickWidth: number; tickSpacing: number } {
  const zScore = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const priceRange = Math.exp(volatility * zScore);
  
  const lowerPrice = currentPrice / priceRange;
  const upperPrice = currentPrice * priceRange;
  
  // Default to standard 0.3% spacing if not specified
  const tickSpacing = customTickSpacing ?? 60;
  
  // Estimate tick width
  const lowerTick = Math.floor(Math.log(lowerPrice) / Math.log(1.0001));
  const upperTick = Math.ceil(Math.log(upperPrice) / Math.log(1.0001));
  const tickWidth = Math.ceil((upperTick - lowerTick) / tickSpacing) * tickSpacing;

  return {
    lowerPrice,
    upperPrice,
    tickWidth,
    tickSpacing,
  };
}
