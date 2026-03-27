/**
 * Impermanent Loss Calculations for Uniswap V3
 * 
 * This module implements impermanent loss (divergence loss) calculations
 * specific to concentrated liquidity positions.
 */

import { ILCalculationParams, ILResult } from '@/types';
import { tickToPrice, getAmountsForLiquidity, tickToSqrtPriceX96 } from './math';

/**
 * Calculate impermanent loss for a concentrated liquidity position
 * @param params - IL calculation parameters
 * @returns IL result with detailed breakdown
 */
export function calculateIL(params: ILCalculationParams): ILResult {
  const {
    entryPrice,
    exitPrice,
    lowerPrice,
    upperPrice,
    depositAmount,
    depositToken,
    token0Decimals,
    token1Decimals,
  } = params;

  // Calculate entry amounts based on deposit mode
  const entryResult = calculateEntryAmounts(
    depositAmount,
    depositToken,
    entryPrice,
    lowerPrice,
    upperPrice,
    token0Decimals,
    token1Decimals
  );

  const { amount0: entryAmount0, amount1: entryAmount1 } = entryResult;

  // Determine range status at exit
  const belowRange = exitPrice < lowerPrice;
  const aboveRange = exitPrice > upperPrice;
  const inRange = !belowRange && !aboveRange;

  // Calculate LP position value at exit
  let exitAmount0: number;
  let exitAmount1: number;

  if (belowRange) {
    // All in token0
    exitAmount0 = entryAmount0 + entryAmount1 / entryPrice;
    exitAmount1 = 0;
  } else if (aboveRange) {
    // All in token1
    exitAmount0 = 0;
    exitAmount1 = entryAmount1 + entryAmount0 * entryPrice;
  } else {
    // In range - calculate based on current price
    const liquidity = calculateLiquidityFromAmounts(
      entryAmount0,
      entryAmount1,
      entryPrice,
      lowerPrice,
      upperPrice,
      token0Decimals,
      token1Decimals
    );

    const amounts = getAmountsAtPrice(
      liquidity,
      exitPrice,
      lowerPrice,
      upperPrice,
      token0Decimals,
      token1Decimals
    );

    exitAmount0 = amounts.amount0;
    exitAmount1 = amounts.amount1;
  }

  // Calculate LP value at exit
  const lpValue = exitAmount0 * exitPrice + exitAmount1;

  // Calculate HODL value (holding initial amounts)
  const hodlValue = entryAmount0 * exitPrice + entryAmount1;

  // Calculate divergence loss
  const divergenceLoss = hodlValue - lpValue;
  const divergenceLossPercent = hodlValue > 0 ? divergenceLoss / hodlValue : 0;

  return {
    lpValue,
    hodlValue,
    divergenceLoss,
    divergenceLossPercent,
    token0Amount: exitAmount0,
    token1Amount: exitAmount1,
    inRange,
    belowRange,
    aboveRange,
  };
}

/**
 * Calculate IL for a range of prices
 * @param params - Base IL parameters (without exitPrice)
 * @param priceRange - Price range to calculate
 * @returns Array of IL results at each price point
 */
export function calculateILGrid(
  params: Omit<ILCalculationParams, 'exitPrice'>,
  priceRange: { min: number; max: number; steps: number }
): Array<{ price: number; il: ILResult }> {
  const { min, max, steps } = priceRange;
  const step = (max - min) / steps;
  const results = [];

  for (let i = 0; i <= steps; i++) {
    const price = min + step * i;
    const il = calculateIL({ ...params, exitPrice: price });
    results.push({ price, il });
  }

  return results;
}

/**
 * Calculate HODL benchmark value
 * @param initialAmount0 - Initial token0 amount
 * @param initialAmount1 - Initial token1 amount
 * @param entryPrice - Entry price
 * @param exitPrice - Exit price
 * @param depositToken - Deposit denomination
 * @returns HODL value in deposit token terms
 */
export function calculateHODLValue(
  initialAmount0: number,
  initialAmount1: number,
  entryPrice: number,
  exitPrice: number,
  depositToken: 'token0' | 'token1' | 'usd'
): number {
  switch (depositToken) {
    case 'token0':
      return initialAmount0 + initialAmount1 / exitPrice;
    case 'token1':
      return initialAmount1 + initialAmount0 * exitPrice;
    case 'usd':
    default:
      return initialAmount0 * exitPrice + initialAmount1;
  }
}

/**
 * Calculate entry amounts based on deposit mode
 */
function calculateEntryAmounts(
  depositAmount: number,
  depositToken: 'token0' | 'token1' | 'usd',
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: number; amount1: number } {
  switch (depositToken) {
    case 'token0':
      return calculateToken0HeavyEntry(
        depositAmount,
        currentPrice,
        lowerPrice,
        upperPrice,
        token0Decimals,
        token1Decimals
      );
    case 'token1':
      return calculateToken1HeavyEntry(
        depositAmount,
        currentPrice,
        lowerPrice,
        upperPrice,
        token0Decimals,
        token1Decimals
      );
    case 'usd':
    default:
      return calculateBalancedEntry(
        depositAmount,
        currentPrice,
        lowerPrice,
        upperPrice,
        token0Decimals,
        token1Decimals
      );
  }
}

/**
 * Calculate balanced entry (50/50 value split at current price)
 */
function calculateBalancedEntry(
  depositUSD: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: number; amount1: number } {
  // For balanced entry, we need to determine optimal token amounts
  // based on the price range and current price

  const sqrtCurrent = Math.sqrt(currentPrice);
  const sqrtLower = Math.sqrt(lowerPrice);
  const sqrtUpper = Math.sqrt(upperPrice);

  if (currentPrice <= lowerPrice) {
    // All in token0
    return {
      amount0: depositUSD / currentPrice,
      amount1: 0,
    };
  } else if (currentPrice >= upperPrice) {
    // All in token1
    return {
      amount0: 0,
      amount1: depositUSD,
    };
  }

  // In range - calculate optimal ratio
  const L = depositUSD / (2 * sqrtCurrent - sqrtLower - currentPrice / sqrtUpper);
  const amount0 = L * (sqrtUpper - sqrtCurrent) / (sqrtCurrent * sqrtUpper);
  const amount1 = L * (sqrtCurrent - sqrtLower);

  return { amount0, amount1 };
}

/**
 * Calculate token0-heavy entry
 */
function calculateToken0HeavyEntry(
  token0Amount: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: number; amount1: number } {
  const sqrtCurrent = Math.sqrt(currentPrice);
  const sqrtLower = Math.sqrt(lowerPrice);
  const sqrtUpper = Math.sqrt(upperPrice);

  if (currentPrice <= lowerPrice) {
    return { amount0: token0Amount, amount1: 0 };
  }

  // Calculate required token1 for the given token0
  const L = token0Amount * sqrtCurrent * sqrtUpper / (sqrtUpper - sqrtCurrent);
  const amount1 = L * (sqrtCurrent - sqrtLower);

  return { amount0: token0Amount, amount1 };
}

/**
 * Calculate token1-heavy entry
 */
function calculateToken1HeavyEntry(
  token1Amount: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: number; amount1: number } {
  const sqrtCurrent = Math.sqrt(currentPrice);
  const sqrtLower = Math.sqrt(lowerPrice);
  const sqrtUpper = Math.sqrt(upperPrice);

  if (currentPrice >= upperPrice) {
    return { amount0: 0, amount1: token1Amount };
  }

  // Calculate required token0 for the given token1
  const L = token1Amount / (sqrtCurrent - sqrtLower);
  const amount0 = L * (sqrtUpper - sqrtCurrent) / (sqrtCurrent * sqrtUpper);

  return { amount0, amount1: token1Amount };
}

/**
 * Calculate liquidity from entry amounts
 */
function calculateLiquidityFromAmounts(
  amount0: number,
  amount1: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): bigint {
  const sqrtCurrent = BigInt(Math.floor(Math.sqrt(currentPrice) * Number(tickToSqrtPriceX96(0))));
  const sqrtLower = tickToSqrtPriceX96(Math.floor(Math.log(lowerPrice) / Math.log(1.0001)));
  const sqrtUpper = tickToSqrtPriceX96(Math.floor(Math.log(upperPrice) / Math.log(1.0001)));

  const amount0BigInt = BigInt(Math.floor(amount0 * 10 ** token0Decimals));
  const amount1BigInt = BigInt(Math.floor(amount1 * 10 ** token1Decimals));

  // Use the math library function
  const { getLiquidityForAmounts } = require('./math');
  return getLiquidityForAmounts(sqrtCurrent, sqrtLower, sqrtUpper, amount0BigInt, amount1BigInt);
}

/**
 * Get amounts at a specific price
 */
function getAmountsAtPrice(
  liquidity: bigint,
  price: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: number; amount1: number } {
  const sqrtPrice = tickToSqrtPriceX96(Math.floor(Math.log(price) / Math.log(1.0001)));
  const sqrtLower = tickToSqrtPriceX96(Math.floor(Math.log(lowerPrice) / Math.log(1.0001)));
  const sqrtUpper = tickToSqrtPriceX96(Math.floor(Math.log(upperPrice) / Math.log(1.0001)));

  const { getAmountsForLiquidity } = require('./math');
  const { amount0, amount1 } = getAmountsForLiquidity(liquidity, sqrtPrice, sqrtLower, sqrtUpper);

  return {
    amount0: Number(amount0) / 10 ** token0Decimals,
    amount1: Number(amount1) / 10 ** token1Decimals,
  };
}

/**
 * Compare V3 IL to V2 IL
 * @param priceChange - Price change ratio (exit/entry)
 * @param lowerPrice - Lower bound (relative to entry)
 * @param upperPrice - Upper bound (relative to entry)
 * @returns Comparison result
 */
export function compareV2V3IL(
  priceChange: number,
  lowerPrice: number,
  upperPrice: number
): {
  v2IL: number;
  v3IL: number;
  reduction: number;
} {
  // V2 IL formula: 2 * sqrt(r) / (1 + r) - 1
  const v2IL = (2 * Math.sqrt(priceChange)) / (1 + priceChange) - 1;

  // V3 IL depends on range
  let v3IL: number;
  if (priceChange < lowerPrice) {
    // Below range - all in token0
    v3IL = 0; // No IL below range (holding token0)
  } else if (priceChange > upperPrice) {
    // Above range - all in token1
    v3IL = 0; // No IL above range (holding token1)
  } else {
    // In range - calculate based on position
    // Simplified approximation
    const rangeWidth = upperPrice - lowerPrice;
    const positionInRange = (priceChange - lowerPrice) / rangeWidth;
    v3IL = v2IL * (1 - Math.abs(positionInRange - 0.5) * 2);
  }

  const reduction = v2IL !== 0 ? (v2IL - v3IL) / Math.abs(v2IL) : 0;

  return { v2IL, v3IL, reduction };
}

/**
 * Analyze IL risk for a position
 * @param lowerPrice - Lower bound price
 * @param upperPrice - Upper bound price
 * @param currentPrice - Current price
 * @param volatility - Expected volatility (annualized)
 * @returns Risk assessment
 */
export function analyzeILRisk(
  lowerPrice: number,
  upperPrice: number,
  currentPrice: number,
  volatility: number
): {
  probabilityBelow: number;
  probabilityAbove: number;
  probabilityInRange: number;
  maxIL: number;
  expectedIL: number;
} {
  // Simplified probability calculation using normal distribution
  const rangeLower = Math.log(lowerPrice / currentPrice);
  const rangeUpper = Math.log(upperPrice / currentPrice);

  // Probability of being below range (price < lowerPrice)
  const probabilityBelow = normalCDF(rangeLower / volatility);

  // Probability of being above range (price > upperPrice)
  const probabilityAbove = 1 - normalCDF(rangeUpper / volatility);

  // Probability of being in range
  const probabilityInRange = 1 - probabilityBelow - probabilityAbove;

  // Max IL (approximate at range boundaries)
  const ilAtLower = Math.abs(Math.log(lowerPrice / currentPrice)) * 0.25;
  const ilAtUpper = Math.abs(Math.log(upperPrice / currentPrice)) * 0.25;
  const maxIL = Math.max(ilAtLower, ilAtUpper);

  // Expected IL (simplified)
  const expectedIL = probabilityBelow * 0 + probabilityInRange * maxIL * 0.5 + probabilityAbove * 0;

  return {
    probabilityBelow,
    probabilityAbove,
    probabilityInRange,
    maxIL,
    expectedIL,
  };
}

/**
 * Standard normal CDF
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}
