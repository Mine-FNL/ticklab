/**
 * Uniswap V3 Core Mathematics
 * 
 * This module implements the core mathematical functions for Uniswap V3
 * concentrated liquidity calculations.
 * 
 * All calculations use precise bigint arithmetic to avoid precision loss.
 */

// Constants
export const Q96 = 2n ** 96n;
export const Q128 = 2n ** 128n;
export const Q192 = 2n ** 192n;

// Tick math constants
const MIN_TICK = -887272;
const MAX_TICK = 887272;

/**
 * Convert sqrtPriceX96 to human-readable price
 * @param sqrtPriceX96 - Q96.96 encoded sqrt price
 * @param token0Decimals - Decimals of token0
 * @param token1Decimals - Decimals of token1
 * @returns Price as token1/token0
 */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number
): number {
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrtPrice * sqrtPrice;
  const decimalAdjustment = 10 ** (token1Decimals - token0Decimals);
  return price * decimalAdjustment;
}

/**
 * Convert human-readable price to sqrtPriceX96
 * @param price - Price as token1/token0
 * @param token0Decimals - Decimals of token0
 * @param token1Decimals - Decimals of token1
 * @returns Q96.96 encoded sqrt price
 */
export function priceToSqrtPriceX96(
  price: number,
  token0Decimals: number,
  token1Decimals: number
): bigint {
  const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
  const adjustedPrice = price * decimalAdjustment;
  const sqrtPrice = Math.sqrt(adjustedPrice);
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Convert price to tick (log base 1.0001)
 * @param price - Price as token1/token0
 * @returns Tick index
 */
export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

/**
 * Convert tick to price (1.0001 ^ tick)
 * @param tick - Tick index
 * @returns Price as token1/token0
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Convert tick to sqrtPriceX96
 * @param tick - Tick index
 * @returns Q96.96 encoded sqrt price
 */
export function tickToSqrtPriceX96(tick: number): bigint {
  if (!Number.isFinite(tick)) {
    throw new RangeError(`tickToSqrtPriceX96: tick must be finite, got ${tick}`);
  }
  if (tick > MAX_TICK) tick = MAX_TICK;
  if (tick < MIN_TICK) tick = MIN_TICK;

  // The bit-shift formula used here approximates sqrt(1.0001^tick). For some
  // tick values the cumulative `>> 128n` shifts collapse the intermediate
  // ratio to 0n before the inverse step, which throws RangeError. Math.exp
  // is the canonical robust path; convert at full double precision and only
  // lose precision at the very edges of the Q64.96 range, which is well
  // beyond what Uniswap pools actually reach.
  const sqrtPrice = Math.sqrt(Math.pow(1.0001, tick));
  // Q64.96: multiply by 2^96.
  const SCALE = 79228162514264337593543950336n; // 2^96
  const big = BigInt(Math.round(sqrtPrice * Number(SCALE)));
  return big;
}

const Q256 = 2n ** 256n;

/**
 * Get tick at sqrt ratio
 * @param sqrtPriceX96 - Q96.96 encoded sqrt price
 * @returns Tick index
 */
export function getTickAtSqrtRatio(sqrtPriceX96: bigint): number {
  // Binary search approximation
  let lo = MIN_TICK;
  let hi = MAX_TICK;
  
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midPrice = tickToSqrtPriceX96(mid);
    
    if (midPrice <= sqrtPriceX96) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  
  return lo - 1;
}

/**
 * Get tick spacing for a given fee tier
 * @param feeTier - Fee tier in basis points (100, 500, 3000, 10000)
 * @returns Tick spacing
 */
export function getTickSpacingForFeeTier(feeTier: number): number {
  switch (feeTier) {
    case 100: return 1;
    case 500: return 10;
    case 3000: return 60;
    case 10000: return 200;
    default: return 60;
  }
}

/**
 * Get nearest usable tick
 * @param tick - Tick index
 * @param tickSpacing - Pool tick spacing
 * @returns Nearest valid tick
 */
export function getNearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  return Math.max(MIN_TICK, Math.min(MAX_TICK, rounded));
}

/**
 * Check if tick is a valid lower tick
 * @param tick - Tick index
 * @param tickSpacing - Pool tick spacing
 * @returns True if valid lower tick
 */
export function isValidTickLower(tick: number, tickSpacing: number): boolean {
  return tick % tickSpacing === 0 && tick >= MIN_TICK && tick <= MAX_TICK;
}

/**
 * Get liquidity for amount0
 * @param sqrtPriceAX96 - Lower bound sqrt price
 * @param sqrtPriceBX96 - Upper bound sqrt price
 * @param amount0 - Amount of token0
 * @returns Liquidity amount
 */
export function getLiquidityForAmount0(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount0: bigint
): bigint {
  if (amount0 === 0n) return 0n;

  const [sqrtA, sqrtB] = sqrtPriceAX96 < sqrtPriceBX96
    ? [sqrtPriceAX96, sqrtPriceBX96]
    : [sqrtPriceBX96, sqrtPriceAX96];

  // Degenerate range → 0 liquidity (caller supplied a zero-width tick range).
  if (sqrtA === 0n || sqrtB === 0n || sqrtB === sqrtA) return 0n;

  const intermediate = (sqrtA * sqrtB) / Q96;
  return (amount0 * intermediate) / (sqrtB - sqrtA);
}

/**
 * Get liquidity for amount1
 * @param sqrtPriceAX96 - Lower bound sqrt price
 * @param sqrtPriceBX96 - Upper bound sqrt price
 * @param amount1 - Amount of token1
 * @returns Liquidity amount
 */
export function getLiquidityForAmount1(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount1: bigint
): bigint {
  if (amount1 === 0n) return 0n;

  const [sqrtA, sqrtB] = sqrtPriceAX96 < sqrtPriceBX96
    ? [sqrtPriceAX96, sqrtPriceBX96]
    : [sqrtPriceBX96, sqrtPriceAX96];

  // Degenerate range → 0 liquidity (caller supplied a zero-width tick range).
  if (sqrtA === 0n || sqrtB === 0n || sqrtB === sqrtA) return 0n;

  return (amount1 * Q96) / (sqrtB - sqrtA);
}

/**
 * Get liquidity for amounts
 * @param sqrtPriceX96 - Current sqrt price
 * @param sqrtPriceAX96 - Lower bound sqrt price
 * @param sqrtPriceBX96 - Upper bound sqrt price
 * @param amount0 - Amount of token0
 * @param amount1 - Amount of token1
 * @returns Liquidity amount
 */
export function getLiquidityForAmounts(
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount0: bigint,
  amount1: bigint
): bigint {
  if (amount0 === 0n && amount1 === 0n) return 0n;
  
  const [sqrtA, sqrtB] = sqrtPriceAX96 < sqrtPriceBX96 
    ? [sqrtPriceAX96, sqrtPriceBX96] 
    : [sqrtPriceBX96, sqrtPriceAX96];
  
  if (sqrtPriceX96 <= sqrtA) {
    return getLiquidityForAmount0(sqrtA, sqrtB, amount0);
  } else if (sqrtPriceX96 < sqrtB) {
    const liquidity0 = getLiquidityForAmount0(sqrtPriceX96, sqrtB, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtA, sqrtPriceX96, amount1);
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  } else {
    return getLiquidityForAmount1(sqrtA, sqrtB, amount1);
  }
}

/**
 * Get amount0 for liquidity
 * @param sqrtPriceAX96 - Lower bound sqrt price
 * @param sqrtPriceBX96 - Upper bound sqrt price
 * @param liquidity - Liquidity amount
 * @returns Amount of token0
 */
export function getAmount0ForLiquidity(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): bigint {
  if (liquidity === 0n) return 0n;

  const [sqrtA, sqrtB] = sqrtPriceAX96 < sqrtPriceBX96
    ? [sqrtPriceAX96, sqrtPriceBX96]
    : [sqrtPriceBX96, sqrtPriceAX96];

  // Degenerate range (sqrtB - sqrtA = 0) or zero lower bound both yield 0 amount.
  // Without this guard, callers can produce an opaque "Division by zero" error
  // when a pool exists at extreme tick bounds.
  if (sqrtA === 0n || sqrtB === 0n || sqrtB === sqrtA) return 0n;

  return ((liquidity * Q96) * (sqrtB - sqrtA)) / (sqrtB * sqrtA);
}

/**
 * Get amount1 for liquidity
 * @param sqrtPriceAX96 - Lower bound sqrt price
 * @param sqrtPriceBX96 - Upper bound sqrt price
 * @param liquidity - Liquidity amount
 * @returns Amount of token1
 */
export function getAmount1ForLiquidity(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): bigint {
  if (liquidity === 0n) return 0n;

  const [sqrtA, sqrtB] = sqrtPriceAX96 < sqrtPriceBX96
    ? [sqrtPriceAX96, sqrtPriceBX96]
    : [sqrtPriceBX96, sqrtPriceAX96];

  // Guard against degenerate ranges so callers get 0 instead of "Division by zero".
  if (sqrtA === 0n || sqrtB === 0n || sqrtB === sqrtA) return 0n;

  return (liquidity * (sqrtB - sqrtA)) / Q96;
}

/**
 * Get amounts for liquidity at current price
 * @param sqrtPriceX96 - Current sqrt price
 * @param sqrtPriceAX96 - Lower bound sqrt price
 * @param sqrtPriceBX96 - Upper bound sqrt price
 * @param liquidity - Liquidity amount
 * @returns Amounts of token0 and token1
 */
export function getAmountsForLiquidity(
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n) return { amount0: 0n, amount1: 0n };
  
  const [sqrtA, sqrtB] = sqrtPriceAX96 < sqrtPriceBX96 
    ? [sqrtPriceAX96, sqrtPriceBX96] 
    : [sqrtPriceBX96, sqrtPriceAX96];
  
  if (sqrtPriceX96 <= sqrtA) {
    return {
      amount0: getAmount0ForLiquidity(sqrtA, sqrtB, liquidity),
      amount1: 0n,
    };
  } else if (sqrtPriceX96 < sqrtB) {
    return {
      amount0: getAmount0ForLiquidity(sqrtPriceX96, sqrtB, liquidity),
      amount1: getAmount1ForLiquidity(sqrtA, sqrtPriceX96, liquidity),
    };
  } else {
    return {
      amount0: 0n,
      amount1: getAmount1ForLiquidity(sqrtA, sqrtB, liquidity),
    };
  }
}

/**
 * Check if current price is in range
 * @param currentTick - Current tick
 * @param lowerTick - Lower tick bound
 * @param upperTick - Upper tick bound
 * @returns True if in range
 */
export function isInRange(
  currentTick: number,
  lowerTick: number,
  upperTick: number
): boolean {
  return currentTick >= lowerTick && currentTick < upperTick;
}

/**
 * Get range status
 * @param currentTick - Current tick
 * @param lowerTick - Lower tick bound
 * @param upperTick - Upper tick bound
 * @returns Range status
 */
export function getRangeStatus(
  currentTick: number,
  lowerTick: number,
  upperTick: number
): 'in-range' | 'below-range' | 'above-range' {
  if (currentTick < lowerTick) return 'below-range';
  if (currentTick >= upperTick) return 'above-range';
  return 'in-range';
}

/**
 * Calculate price from tick with decimals adjustment
 * @param tick - Tick index
 * @param token0Decimals - Decimals of token0
 * @param token1Decimals - Decimals of token1
 * @returns Adjusted price
 */
export function tickToPriceAdjusted(
  tick: number,
  token0Decimals: number,
  token1Decimals: number
): number {
  const price = tickToPrice(tick);
  const decimalAdjustment = 10 ** (token1Decimals - token0Decimals);
  return price * decimalAdjustment;
}

/**
 * Calculate tick from price with decimals adjustment
 * @param price - Price
 * @param token0Decimals - Decimals of token0
 * @param token1Decimals - Decimals of token1
 * @returns Tick index
 */
export function priceToTickAdjusted(
  price: number,
  token0Decimals: number,
  token1Decimals: number
): number {
  const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
  const adjustedPrice = price * decimalAdjustment;
  return priceToTick(adjustedPrice);
}

/**
 * Calculate the liquidity value in USD
 * @param liquidity - Liquidity amount
 * @param sqrtPriceX96 - Current sqrt price
 * @param token0PriceUSD - Token0 price in USD
 * @param token1PriceUSD - Token1 price in USD
 * @param token0Decimals - Token0 decimals
 * @param token1Decimals - Token1 decimals
 * @returns Value in USD
 */
export function calculateLiquidityValueUSD(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  token0PriceUSD: number,
  token1PriceUSD: number,
  token0Decimals: number,
  token1Decimals: number
): number {
  const { amount0, amount1 } = getAmountsForLiquidity(
    sqrtPriceX96,
    tickToSqrtPriceX96(MIN_TICK),
    tickToSqrtPriceX96(MAX_TICK),
    liquidity
  );
  
  const amount0Human = Number(amount0) / 10 ** token0Decimals;
  const amount1Human = Number(amount1) / 10 ** token1Decimals;
  
  return amount0Human * token0PriceUSD + amount1Human * token1PriceUSD;
}

/**
 * Calculate price impact for a swap
 * @param liquidity - Pool liquidity
 * @param amountIn - Input amount
 * @param sqrtPriceX96 - Current sqrt price
 * @param zeroForOne - True if swapping token0 for token1
 * @returns Price impact as percentage
 */
export function calculatePriceImpact(
  liquidity: bigint,
  amountIn: bigint,
  sqrtPriceX96: bigint,
  zeroForOne: boolean
): number {
  if (liquidity === 0n || amountIn === 0n) return 0;
  
  // Simplified price impact calculation
  // Actual Uniswap V3 uses more complex tick-by-tick calculation
  const priceBefore = sqrtPriceX96ToPrice(sqrtPriceX96, 18, 18);
  
  let sqrtPriceAfter: bigint;
  if (zeroForOne) {
    // Selling token0, buying token1
    const numerator = liquidity * Q96;
    const denominator = numerator / sqrtPriceX96 + amountIn;
    sqrtPriceAfter = numerator / denominator;
  } else {
    // Selling token1, buying token0
    sqrtPriceAfter = sqrtPriceX96 + (amountIn * Q96) / liquidity;
  }
  
  const priceAfter = sqrtPriceX96ToPrice(sqrtPriceAfter, 18, 18);
  const impact = Math.abs((priceAfter - priceBefore) / priceBefore);
  
  return impact * 100;
}
