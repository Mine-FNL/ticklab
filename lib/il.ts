/**
 * Impermanent Loss Calculator
 * 
 * Uniswap V3 impermanent loss is more nuanced than V2 due to range-bound positions.
 * 
 * Key concepts:
 * - Divergence Loss: The loss in value compared to HODL due to passive rebalancing
 * - IL is realized when price moves outside your range OR when you close the position
 * - Fees earned can offset or exceed IL depending on volume and range width
 * 
 * For Uniswap V3 positions:
 * - IL is position-specific (depends on your tick range)
 * - A tighter range = more IL but more fees per unit of liquidity
 * - Being out of range = full IL (position becomes 100% one token)
 * 
 * Mathematical Reference:
 * - HODL value = x0 * P0 + y0 (where P0 is entry price, x0,y0 are token amounts)
 * - LP value = x(P) + y(P) * P (depends on current price and position state)
 * - IL = HODL - LP (positive = loss)
 * 
 * For a full-range position (equivalent to V2):
 * - IL = 2 * sqrt(r) / (1 + r) - 1 where r = P_current / P_entry
 * 
 * For concentrated positions, IL is more complex and depends on:
 * - Whether current price is in range
 * - Token composition within the range
 */

import { tickToSqrtPrice, sqrtPriceToTick, getTokenAmountsFromLiquidity, getRangeState } from './lp-math';

/**
 * IL Calculation result interface
 */
export interface ILCalculation {
  /** Absolute loss vs HODL in token1 terms (positive = loss) */
  ilAbsolute: number;
  /** Percentage loss relative to HODL (0.05 = 5% loss) */
  ilPercent: number;
  /** More accurate term for Uniswap V3 - captures the divergence from HODL */
  divergenceLoss: number;
  /** Value if just held (HODL strategy) */
  hodlValue: number;
  /** Current LP position value */
  lpValue: number;
  /** Fees earned minus costs = net benefit of LPing */
  excessReturn: number;
}

/**
 * Calculate impermanent loss for a simple price move.
 * 
 * This is for a full-range (V2-equivalent) position.
 * For concentrated positions, use calculateILForRange.
 * 
 * @param priceInitial - entry price (token1/token0)
 * @param priceCurrent - current price (token1/token0)
 * @param feeReward - fees earned in token1 terms
 * @param gasCosts - gas paid for mint/rebalance (deducted from excessReturn)
 * @returns ILCalculation with all metrics
 */
export function calculateIL(
  priceInitial: number,
  priceCurrent: number,
  feeReward: number,
  gasCosts: number = 0
): ILCalculation {
  
  if (priceInitial <= 0 || priceCurrent <= 0) {
    throw new Error('Prices must be positive');
  }
  
  // For a V2-equivalent LP:
  // HODL: Hold x0 token0 and y0 token1. Value = x0 * P_current + y0
  // LP: Provide to pool. After swap, you hold:
  //   x = x0 + y0 / (2 * sqrt(P_current))  (approximately for V2 constant product)
  // Actually for V2: x * y = k, x * P = y => x = sqrt(k/P), y = sqrt(k*P)
  // 
  // For a 50/50 value deposit at entry:
  // x0 = V / (2 * P_initial), y0 = V / 2
  // k = x0 * y0 = V^2 / (4 * P_initial)
  // 
  // At current price:
  // LP value = 2 * sqrt(k * P_current) = 2 * sqrt(V^2 / (4 * P_initial) * P_current)
  //           = V * sqrt(P_current / P_initial)
  // HODL value = x0 * P_current + y0 = (V / (2 * P_initial)) * P_current + V / 2
  //            = V * (P_current / (2 * P_initial)) + V / 2
  //            = V * (P_current / P_initial + 1) / 2
  //
  // IL = HODL - LP (we want LP to be higher, so loss = HODL - LP when positive)
  
  const priceRatio = priceCurrent / priceInitial;
  
  // HODL value at current price (starting with 1 unit of value)
  const hodlValue = (priceRatio + 1) / 2;
  
  // LP value at current price (V2 AMM)
  const lpValue = Math.sqrt(priceRatio);
  
  // IL absolute (positive = loss)
  const ilAbsolute = hodlValue - lpValue;
  
  // IL percent
  const ilPercent = ilAbsolute / hodlValue;
  
  // Divergence loss (same as IL percent but more accurate term)
  const divergenceLoss = ilPercent;
  
  // Net result: fees - IL
  const excessReturn = feeReward - Math.max(0, ilAbsolute) - gasCosts;
  
  return {
    ilAbsolute,
    ilPercent,
    divergenceLoss,
    hodlValue,
    lpValue,
    excessReturn,
  };
}

/**
 * Calculate IL for a concentrated (UniV3) position.
 * 
 * This accounts for:
 * - Position range bounds
 * - Whether current price is in or out of range
 * - Different IL profiles for in-range vs out-of-range
 * 
 * @param priceInitial - entry price (token1/token0)
 * @param priceExit - exit/current price (token1/token0)
 * @param lowerTick - lower bound of position
 * @param upperTick - upper bound of position
 * @param liquidity - position liquidity (bigint)
 * @param feeReward - fees earned in token1 terms
 * @param decimals0 - decimals for token0 (e.g., 18 for WETH)
 * @param decimals1 - decimals for token1 (e.g., 6 for USDC)
 * @param gasCosts - gas costs to account for
 */
export function calculateILForRange(
  priceInitial: number,
  priceExit: number,
  lowerTick: number,
  upperTick: number,
  liquidity: bigint,
  feeReward: number,
  decimals0: number = 18,
  decimals1: number = 6,
  gasCosts: number = 0
): ILCalculation {
  
  if (priceInitial <= 0 || priceExit <= 0) {
    throw new Error('Prices must be positive');
  }
  
  // Convert ticks to sqrt prices
  const sqrtPriceLower = tickToSqrtPrice(lowerTick);
  const sqrtPriceUpper = tickToSqrtPrice(upperTick);
  const tickInitial = Math.log(priceInitial) / Math.log(1.0001);
  const tickExit = Math.log(priceExit) / Math.log(1.0001);
  
  // Approximate sqrt prices from ticks (we don't have exact tick-to-sqrt for arbitrary ticks)
  // Use tickToSqrtPrice for the bounds
  const sqrtPriceEntry = tickToSqrtPrice(Math.round(tickInitial));
  const sqrtPriceCurrent = tickToSqrtPrice(Math.round(tickExit));
  
  // Calculate entry state
  const entryRangeState = getRangeState(Math.round(tickInitial), lowerTick, upperTick);
  
  // At entry, we need to determine initial token composition
  // For a balanced deposit, we use entry price to determine amounts
  // Assume 50/50 value split at entry
  
  // First, figure out what liquidity we'd need for a balanced position
  // Using the mid-price for the initial calculation
  const { amount0: initAmount0, amount1: initAmount1 } = getTokenAmountsFromLiquidity(
    sqrtPriceEntry,
    sqrtPriceLower,
    sqrtPriceUpper,
    liquidity,
    false
  );
  
  // HODL calculation: what would the tokens be worth if held?
  // Starting with the same token amounts as the LP position
  const hodlValue = getHODLValue(initAmount0, initAmount1, priceExit, decimals0, decimals1);
  
  // LP value at current price
  const { amount0: currAmount0, amount1: currAmount1 } = getTokenAmountsFromLiquidity(
    sqrtPriceCurrent,
    sqrtPriceLower,
    sqrtPriceUpper,
    liquidity,
    false
  );
  
  const lpValue = getHODLValue(currAmount0, currAmount1, priceExit, decimals0, decimals1);
  
  // IL calculations
  const ilAbsolute = hodlValue - lpValue;
  const ilPercent = hodlValue > 0 ? ilAbsolute / hodlValue : 0;
  
  // Excess return: fees minus IL (and gas)
  const excessReturn = feeReward - Math.max(0, ilAbsolute) - gasCosts;
  
  return {
    ilAbsolute,
    ilPercent,
    divergenceLoss: ilPercent,
    hodlValue,
    lpValue,
    excessReturn,
  };
}

/**
 * Calculate what happens to a position's value if price moves to a new level.
 * Useful for scenario analysis.
 * 
 * @param entryPrice - original entry price
 * @param currentPrice - price to calculate value at
 * @param lowerTick - lower bound
 * @param upperTick - upper bound  
 * @param initialToken0 - initial token0 amount (for HODL comparison)
 * @param initialToken1 - initial token1 amount (for HODL comparison)
 * @param liquidity - position liquidity
 * @param decimals0 - token0 decimals
 * @param decimals1 - token1 decimals
 * @param unclaimedFees - fees accumulated but not yet claimed
 */
export function calculatePositionILAtPrice(
  entryPrice: number,
  currentPrice: number,
  lowerTick: number,
  upperTick: number,
  initialToken0: bigint,
  initialToken1: bigint,
  liquidity: bigint,
  decimals0: number,
  decimals1: number,
  unclaimedFees: number = 0
): ILCalculation {
  
  const sqrtPriceLower = tickToSqrtPrice(lowerTick);
  const sqrtPriceUpper = tickToSqrtPrice(upperTick);
  
  // Current tick
  const tickCurrent = Math.round(Math.log(currentPrice) / Math.log(1.0001));
  const sqrtPriceCurrent = tickToSqrtPrice(tickCurrent);
  
  // HODL value at current price
  const hodlValue = getHODLValue(initialToken0, initialToken1, currentPrice, decimals0, decimals1);
  
  // LP value at current price (including unclaimed fees)
  const { amount0, amount1 } = getTokenAmountsFromLiquidity(
    sqrtPriceCurrent,
    sqrtPriceLower,
    sqrtPriceUpper,
    liquidity,
    false
  );
  
  const lpValueRaw = getHODLValue(amount0, amount1, currentPrice, decimals0, decimals1);
  const lpValue = lpValueRaw + unclaimedFees;
  
  // IL
  const ilAbsolute = hodlValue - lpValue;
  const ilPercent = hodlValue > 0 ? ilAbsolute / hodlValue : 0;
  
  // Entry value for return calculation
  const entryValue = getHODLValue(initialToken0, initialToken1, entryPrice, decimals0, decimals1);
  const lpReturn = entryValue > 0 ? (lpValue - entryValue) / entryValue : 0;
  const hodlReturn = entryValue > 0 ? (hodlValue - entryValue) / entryValue : 0;
  
  return {
    ilAbsolute,
    ilPercent,
    divergenceLoss: ilPercent,
    hodlValue,
    lpValue,
    excessReturn: lpReturn - hodlReturn,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate HODL value from token amounts at a given price.
 */
function getHODLValue(
  amount0: bigint,
  amount1: bigint,
  price: number,
  decimals0: number,
  decimals1: number
): number {
  const amount0Decimal = Number(amount0) / Math.pow(10, decimals0);
  const amount1Decimal = Number(amount1) / Math.pow(10, decimals1);
  
  // Value in token1 terms: amount0 * price + amount1
  return amount0Decimal * price + amount1Decimal;
}

/**
 * Quick IL estimate for common scenarios.
 * Useful for UI showing "IL risk" level.
 * 
 * @param priceRangePercent - range width as percentage (e.g., 10 for ±10%)
 * @param priceMovePercent - expected price move as percentage (e.g., 5 for 5%)
 * @returns IL estimate as decimal
 */
export function estimateILForRange(
  priceRangePercent: number,
  priceMovePercent: number
): number {
  // Simplified IL model for narrow ranges
  // IL ≈ (range_width^2) / 8 at midpoint (approx)
  // This is a rough approximation
  
  const rangeHalf = priceRangePercent / 100;
  const move = priceMovePercent / 100;
  
  // If price moves beyond range, IL is roughly proportional to the move beyond
  if (Math.abs(move) > rangeHalf) {
    const overshoot = Math.abs(move) - rangeHalf;
    // IL grows approximately linearly with overshoot
    return Math.min(0.99, overshoot * 0.5);
  }
  
  // Within range, IL is much smaller
  // Approximate: IL ≈ (move^2) / (2 * range) for small moves within range
  const ilEstimate = (move * move) / (2 * rangeHalf);
  
  return Math.min(0.5, ilEstimate);
}
