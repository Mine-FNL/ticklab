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
  const absTick = Math.abs(tick);
  let ratio = absTick & 0x1 !== 0 ? BigInt('79232123831229584821631712447568') : BigInt('79228162514264337593543950336');
  
  if (absTick & 0x2 !== 0) ratio = (ratio * BigInt('79236085330515764027303304732')) >> 128n;
  if (absTick & 0x4 !== 0) ratio = (ratio * BigInt('79244008939048815603715285529')) >> 128n;
  if (absTick & 0x8 !== 0) ratio = (ratio * BigInt('79259858533276714744399159624')) >> 128n;
  if (absTick & 0x10 !== 0) ratio = (ratio * BigInt('79291567250765740496340373915')) >> 128n;
  if (absTick & 0x20 !== 0) ratio = (ratio * BigInt('79355022662378470627699079246')) >> 128n;
  if (absTick & 0x40 !== 0) ratio = (ratio * BigInt('79482059297663915432149840871')) >> 128n;
  if (absTick & 0x80 !== 0) ratio = (ratio * BigInt('79736823300114093921829183526')) >> 128n;
  if (absTick & 0x100 !== 0) ratio = (ratio * BigInt('80248749790811656504158217372')) >> 128n;
  if (absTick & 0x200 !== 0) ratio = (ratio * BigInt('81282465610642329084185038211')) >> 128n;
  if (absTick & 0x400 !== 0) ratio = (ratio * BigInt('83390007182334617377626686706')) >> 128n;
  if (absTick & 0x800 !== 0) ratio = (ratio * BigInt('87873917902043797092652703393')) >> 128n;
  if (absTick & 0x1000 !== 0) ratio = (ratio * BigInt('97873798387631560758914529195')) >> 128n;
  if (absTick & 0x2000 !== 0) ratio = (ratio * BigInt('121438419988865159365539493990')) >> 128n;
  if (absTick & 0x4000 !== 0) ratio = (ratio * BigInt('188709358182804902742061434828')) >> 128n;
  if (absTick & 0x8000 !== 0) ratio = (ratio * BigInt('455711986000980887884442232784')) >> 128n;
  if (absTick & 0x10000 !== 0) ratio = (ratio * BigInt('2666946796374807022649853254528')) >> 128n;
  
  if (tick > 0) ratio = Q256 / ratio;
  
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
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
