/**
 * Position Entry Calculations
 * 
 * This module implements position entry amount calculations for different
 * deposit modes (balanced, token0-heavy, token1-heavy).
 */

import { PositionEntryParams, PositionEntryResult } from '@/types';
import {
  getLiquidityForAmounts,
  tickToSqrtPriceX96,
  priceToTick,
} from './math';

/**
 * Calculate position entry amounts
 * @param params - Position entry parameters
 * @returns Entry result with token amounts and liquidity
 */
export function calculatePositionEntry(
  params: PositionEntryParams
): PositionEntryResult {
  const {
    depositAmount,
    depositToken,
    currentPrice,
    lowerPrice,
    upperPrice,
    token0Decimals,
    token1Decimals,
  } = params;

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
 * @param depositUSD - Deposit amount in USD
 * @param currentPrice - Current price
 * @param lowerPrice - Lower price bound
 * @param upperPrice - Upper price bound
 * @param token0Decimals - Token0 decimals
 * @param token1Decimals - Token1 decimals
 * @returns Entry result
 */
export function calculateBalancedEntry(
  depositUSD: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): PositionEntryResult {
  const sqrtCurrent = Math.sqrt(currentPrice);
  const sqrtLower = Math.sqrt(lowerPrice);
  const sqrtUpper = Math.sqrt(upperPrice);

  let token0Amount: number;
  let token1Amount: number;

  if (currentPrice <= lowerPrice) {
    // All in token0
    if (currentPrice <= 0) {
      throw new Error(`currentPrice must be > 0, got ${currentPrice}`);
    }
    token0Amount = depositUSD / currentPrice;
    token1Amount = 0;
  } else if (currentPrice >= upperPrice) {
    // All in token1
    token0Amount = 0;
    token1Amount = depositUSD;
  } else {
    // In range - calculate optimal ratio
    // Formula: L = depositUSD / (2 * sqrt(P) - sqrt(Pa) - P / sqrt(Pb))
    const denominator = 2 * sqrtCurrent - sqrtLower - currentPrice / sqrtUpper;
    // Degenerate denominators can occur when the price sits exactly at the
    // boundary or when lowerPrice ≈ upperPrice (zero-width range). Without
    // this guard, the user gets an opaque "Division by zero".
    if (denominator <= 0 || !Number.isFinite(denominator)) {
      throw new Error(
        `Degenerate range: lowerPrice=${lowerPrice}, upperPrice=${upperPrice}, currentPrice=${currentPrice}. Use a wider tick range.`,
      );
    }
    const L = depositUSD / denominator;
    if (sqrtCurrent === 0 || sqrtUpper === 0) {
      throw new Error(`sqrt price is zero — bounds out of valid range.`);
    }
    token0Amount = L * (sqrtUpper - sqrtCurrent) / (sqrtCurrent * sqrtUpper);
    token1Amount = L * (sqrtCurrent - sqrtLower);
  }

  // Calculate liquidity
  const liquidity = calculateLiquidity(
    token0Amount,
    token1Amount,
    currentPrice,
    lowerPrice,
    upperPrice,
    token0Decimals,
    token1Decimals
  );

  return {
    token0Amount,
    token1Amount,
    liquidity,
    valueUSD: depositUSD,
  };
}

/**
 * Calculate token0-heavy entry
 * @param token0Amount - Amount of token0 to deposit
 * @param currentPrice - Current price
 * @param lowerPrice - Lower price bound
 * @param upperPrice - Upper price bound
 * @param token0Decimals - Token0 decimals
 * @param token1Decimals - Token1 decimals
 * @returns Entry result
 */
export function calculateToken0HeavyEntry(
  token0Amount: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): PositionEntryResult {
  const sqrtCurrent = Math.sqrt(currentPrice);
  const sqrtLower = Math.sqrt(lowerPrice);
  const sqrtUpper = Math.sqrt(upperPrice);

  let token1Amount: number;

  if (currentPrice <= lowerPrice) {
    // All in token0, no token1 needed
    token1Amount = 0;
  } else if (currentPrice >= upperPrice) {
    // Can't deposit token0 when above range
    throw new Error('Cannot deposit token0 when price is above range');
  } else {
    // Calculate required token1 for the given token0
    // L = amount0 * sqrt(P) * sqrt(Pb) / (sqrt(Pb) - sqrt(P))
    const L = token0Amount * sqrtCurrent * sqrtUpper / (sqrtUpper - sqrtCurrent);
    token1Amount = L * (sqrtCurrent - sqrtLower);
  }

  // Calculate liquidity
  const liquidity = calculateLiquidity(
    token0Amount,
    token1Amount,
    currentPrice,
    lowerPrice,
    upperPrice,
    token0Decimals,
    token1Decimals
  );

  const valueUSD = token0Amount * currentPrice + token1Amount;

  return {
    token0Amount,
    token1Amount,
    liquidity,
    valueUSD,
  };
}

/**
 * Calculate token1-heavy entry
 * @param token1Amount - Amount of token1 to deposit
 * @param currentPrice - Current price
 * @param lowerPrice - Lower price bound
 * @param upperPrice - Upper price bound
 * @param token0Decimals - Token0 decimals
 * @param token1Decimals - Token1 decimals
 * @returns Entry result
 */
export function calculateToken1HeavyEntry(
  token1Amount: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): PositionEntryResult {
  const sqrtCurrent = Math.sqrt(currentPrice);
  const sqrtLower = Math.sqrt(lowerPrice);
  const sqrtUpper = Math.sqrt(upperPrice);

  let token0Amount: number;

  if (currentPrice >= upperPrice) {
    // All in token1, no token0 needed
    token0Amount = 0;
  } else if (currentPrice <= lowerPrice) {
    // Can't deposit token1 when below range
    throw new Error('Cannot deposit token1 when price is below range');
  } else {
    // Calculate required token0 for the given token1
    // L = amount1 / (sqrt(P) - sqrt(Pa))
    const L = token1Amount / (sqrtCurrent - sqrtLower);
    token0Amount = L * (sqrtUpper - sqrtCurrent) / (sqrtCurrent * sqrtUpper);
  }

  // Calculate liquidity
  const liquidity = calculateLiquidity(
    token0Amount,
    token1Amount,
    currentPrice,
    lowerPrice,
    upperPrice,
    token0Decimals,
    token1Decimals
  );

  const valueUSD = token0Amount * currentPrice + token1Amount;

  return {
    token0Amount,
    token1Amount,
    liquidity,
    valueUSD,
  };
}

/**
 * Calculate liquidity from amounts
 */
function calculateLiquidity(
  amount0: number,
  amount1: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): bigint {
  const currentTick = priceToTick(currentPrice);
  const lowerTick = priceToTick(lowerPrice);
  const upperTick = priceToTick(upperPrice);

  const sqrtPriceX96 = tickToSqrtPriceX96(currentTick);
  const sqrtPriceAX96 = tickToSqrtPriceX96(lowerTick);
  const sqrtPriceBX96 = tickToSqrtPriceX96(upperTick);

  const amount0BigInt = BigInt(Math.floor(amount0 * 10 ** token0Decimals));
  const amount1BigInt = BigInt(Math.floor(amount1 * 10 ** token1Decimals));

  return getLiquidityForAmounts(
    sqrtPriceX96,
    sqrtPriceAX96,
    sqrtPriceBX96,
    amount0BigInt,
    amount1BigInt
  );
}

/**
 * Calculate position value at a given price
 * @param liquidity - Position liquidity
 * @param price - Current price
 * @param lowerPrice - Lower price bound
 * @param upperPrice - Upper price bound
 * @param token0Decimals - Token0 decimals
 * @param token1Decimals - Token1 decimals
 * @returns Position value in USD
 */
export function calculatePositionValueAtPrice(
  liquidity: bigint,
  price: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): number {
  const { getAmountsForLiquidity, tickToSqrtPriceX96, priceToTick } = require('./math');

  const priceTick = priceToTick(price);
  const lowerTick = priceToTick(lowerPrice);
  const upperTick = priceToTick(upperPrice);

  const sqrtPriceX96 = tickToSqrtPriceX96(priceTick);
  const sqrtPriceAX96 = tickToSqrtPriceX96(lowerTick);
  const sqrtPriceBX96 = tickToSqrtPriceX96(upperTick);

  const { amount0, amount1 } = getAmountsForLiquidity(
    liquidity,
    sqrtPriceX96,
    sqrtPriceAX96,
    sqrtPriceBX96
  );

  const amount0Human = Number(amount0) / 10 ** token0Decimals;
  const amount1Human = Number(amount1) / 10 ** token1Decimals;

  return amount0Human * price + amount1Human;
}

/**
 * Calculate position composition at a given price
 * @param liquidity - Position liquidity
 * @param price - Current price
 * @param lowerPrice - Lower price bound
 * @param upperPrice - Upper price bound
 * @param token0Decimals - Token0 decimals
 * @param token1Decimals - Token1 decimals
 * @returns Token amounts
 */
export function calculatePositionComposition(
  liquidity: bigint,
  price: number,
  lowerPrice: number,
  upperPrice: number,
  token0Decimals: number,
  token1Decimals: number
): { token0Amount: number; token1Amount: number; token0Ratio: number } {
  const { getAmountsForLiquidity, tickToSqrtPriceX96, priceToTick } = require('./math');

  const priceTick = priceToTick(price);
  const lowerTick = priceToTick(lowerPrice);
  const upperTick = priceToTick(upperPrice);

  const sqrtPriceX96 = tickToSqrtPriceX96(priceTick);
  const sqrtPriceAX96 = tickToSqrtPriceX96(lowerTick);
  const sqrtPriceBX96 = tickToSqrtPriceX96(upperTick);

  const { amount0, amount1 } = getAmountsForLiquidity(
    liquidity,
    sqrtPriceX96,
    sqrtPriceAX96,
    sqrtPriceBX96
  );

  const token0Amount = Number(amount0) / 10 ** token0Decimals;
  const token1Amount = Number(amount1) / 10 ** token1Decimals;

  const totalValue = token0Amount * price + token1Amount;
  const token0Ratio = totalValue > 0 ? (token0Amount * price) / totalValue : 0;

  return { token0Amount, token1Amount, token0Ratio };
}

/**
 * Calculate optimal range for a given volatility
 * @param currentPrice - Current price
 * @param volatility - Expected volatility (annualized)
 * @param confidence - Confidence level (e.g., 0.95 for 95%)
 * @returns Optimal price range
 */
export function calculateOptimalRange(
  currentPrice: number,
  volatility: number,
  confidence: number = 0.95
): { lowerPrice: number; upperPrice: number; width: number } {
  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.68: 1,
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };

  const zScore = zScores[confidence] ?? 1.96;

  // Calculate price range based on volatility
  // Using log-normal distribution assumption
  const logRange = zScore * volatility;

  const lowerPrice = currentPrice * Math.exp(-logRange);
  const upperPrice = currentPrice * Math.exp(logRange);
  const width = (upperPrice - lowerPrice) / currentPrice;

  return { lowerPrice, upperPrice, width };
}

/**
 * Calculate range width from ticks
 * @param lowerTick - Lower tick
 * @param upperTick - Upper tick
 * @returns Range width as percentage
 */
export function calculateRangeWidth(
  lowerTick: number,
  upperTick: number
): number {
  const lowerPrice = Math.pow(1.0001, lowerTick);
  const upperPrice = Math.pow(1.0001, upperTick);
  const midPrice = Math.sqrt(lowerPrice * upperPrice);

  return (upperPrice - lowerPrice) / midPrice;
}

/**
 * Suggest range based on price history
 * @param prices - Array of historical prices
 * @param percentile - Percentile for range bounds (e.g., 0.1 for 10th/90th)
 * @returns Suggested range
 */
export function suggestRangeFromHistory(
  prices: number[],
  percentile: number = 0.1
): { lowerPrice: number; upperPrice: number } {
  const sortedPrices = [...prices].sort((a, b) => a - b);

  const lowerIndex = Math.floor(sortedPrices.length * percentile);
  const upperIndex = Math.floor(sortedPrices.length * (1 - percentile));

  return {
    lowerPrice: sortedPrices[lowerIndex],
    upperPrice: sortedPrices[upperIndex],
  };
}

/**
 * Calculate capital efficiency vs V2
 * @param lowerPrice - Lower price bound
 * @param upperPrice - Upper price bound
 * @returns Capital efficiency multiplier
 */
export function calculateCapitalEfficiency(
  lowerPrice: number,
  upperPrice: number
): number {
  const sqrtLower = Math.sqrt(lowerPrice);
  const sqrtUpper = Math.sqrt(upperPrice);

  // Capital efficiency = 1 / (1 - sqrt(lower/upper))
  return 1 / (1 - sqrtLower / sqrtUpper);
}

/**
 * Estimate time in range based on volatility
 * @param lowerPrice - Lower price bound
 * @param upperPrice - Upper price bound
 * @param currentPrice - Current price
 * @param volatility - Annualized volatility
 * @returns Estimated time in range (0-1)
 */
export function estimateTimeInRange(
  lowerPrice: number,
  upperPrice: number,
  currentPrice: number,
  volatility: number
): number {
  // Simplified estimate using normal distribution
  const logLower = Math.log(lowerPrice / currentPrice);
  const logUpper = Math.log(upperPrice / currentPrice);

  // Probability of staying within range (simplified)
  // In reality, this requires more complex stochastic calculus
  const rangeWidth = logUpper - logLower;
  const timeInRange = Math.min(1, Math.max(0, 1 - volatility / rangeWidth));

  return timeInRange;
}
