/**
 * LP Math Engine - Core Uniswap V3 Math
 * 
 * Implements precise Uniswap V3 liquidity math using the official formulas.
 * All on-chain values use BigInt for precision.
 * 
 * Key Uniswap V3 concepts:
 * - sqrtPriceX96: Price represented as Q64.96 fixed-point (sqrt(price) * 2^96)
 * - Tick: Discrete price level where tick = floor(log_1.0001(price))
 * - Liquidity: Virtual reserves that scale with price range
 * 
 * Formulas reference:
 * - price = (sqrtPriceX96 / 2^96)^2
 * - tick = floor(log_1.0001(price))
 * - tickToSqrtPrice = (1.0001^tick)^0.5 * 2^96
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** The immutable fee tier tick spacing */
export const TICK_SPACING: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

/** 1.0001 = e^(ln(1.0001)) - the base for Uniswap V3 tick spacing */
const TICK_BASE = 1.0001;

/** 2^96 - used for sqrtPriceX96 conversions */
const SQRT_PRICE_X96_PRECISION = BigInt(2 ** 96);

/** 2^128 - used in liquidity calculations */
const LIQUIDITY_PRECISION = BigInt(2 ** 128);

// ─────────────────────────────────────────────────────────────────────────────
// TICK <-> PRICE CONVERSIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert sqrtPriceX96 to tick index.
 * 
 * tick = floor(log_1.0001(price))
 * price = (sqrtPriceX96 / 2^96)^2
 * 
 * Using the relationship:
 * tick = floor(ln(price) / ln(1.0001))
 * 
 * @param sqrtPrice - sqrtPriceX96 as BigInt (from slot0.sqrtPriceX96)
 * @returns tick index (integer)
 */
export function sqrtPriceToTick(sqrtPrice: bigint): number {
  if (sqrtPrice <= 0n) {
    throw new Error('sqrtPrice must be positive');
  }
  
  // Get the ratio sqrtPrice / 2^96 as a float for log calculation
  const sqrtRatio = Number(sqrtPrice) / Number(SQRT_PRICE_X96_PRECISION);
  
  if (sqrtRatio <= 0) {
    throw new Error('Invalid sqrtPrice ratio');
  }
  
  // price = sqrtRatio^2, then tick = log_1.0001(price) = 2 * log(sqrtRatio) / log(1.0001)
  const logSqrtRatio = Math.log(sqrtRatio);
  const tick = Math.floor((2 * logSqrtRatio) / Math.log(TICK_BASE));
  
  return tick;
}

/**
 * Convert tick index to sqrtPriceX96.
 * 
 * sqrtPriceX96 = (1.0001^(tick/2)) * 2^96
 * 
 * This is the inverse of sqrtPriceToTick.
 * 
 * @param tick - tick index (integer)
 * @returns sqrtPriceX96 as BigInt
 */
export function tickToSqrtPrice(tick: number): bigint {
  // sqrtPrice = 1.0001^(tick/2)
  // sqrtPriceX96 = sqrtPrice * 2^96
  const sqrtPrice = Math.pow(TICK_BASE, tick / 2);
  const sqrtPriceX96 = sqrtPrice * Number(SQRT_PRICE_X96_PRECISION);
  
  return BigInt(Math.round(sqrtPriceX96));
}

/**
 * Convert tick to human-readable price (token1/token0).
 * 
 * price = 1.0001^tick
 * 
 * For ETH/USDC where token0=ETH, token1=USDC:
 * price = USDC per ETH
 * 
 * @param tick - tick index
 * @returns price as number (token1/token0)
 */
export function tickToPrice(tick: number): number {
  return Math.pow(TICK_BASE, tick);
}

/**
 * Convert price to tick (integer).
 * @param price - price as token1/token0
 * @returns nearest valid tick
 */
export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(TICK_BASE));
}

/**
 * Round tick to nearest valid tick for a given fee tier.
 * @param tick - raw tick
 * @param feeTier - fee tier in bps
 * @returns tick rounded to tick spacing
 */
export function roundTickToFeeTier(tick: number, feeTier: number): number {
  const spacing = TICK_SPACING[feeTier] ?? 60;
  return Math.round(tick / spacing) * spacing;
}

// ─────────────────────────────────────────────────────────────────────────────
// BIGINT MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multiply a * b / c with optional rounding up.
 * Uses full precision before dividing to minimize rounding error.
 */
function mulDiv(a: bigint, b: bigint, c: bigint, roundUp: boolean): bigint {
  if (c === 0n) throw new Error('Division by zero');
  const product = a * b;
  if (roundUp) {
    return (product / c) + ((product % c > 0n) ? 1n : 0n);
  }
  return product / c;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIQUIDITY <-> TOKEN AMOUNTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate token amounts from liquidity at a given price.
 * 
 * Uniswap V3 uses virtual liquidity that is constant within a position's range.
 * When price is within [sqrtPriceLower, sqrtPriceUpper]:
 * 
 * - token0 needed: Δx = Δ(1/√P) * L
 *   = (1/√P_lower - 1/√P) * L when P <= P_lower (all token0)
 *   = (1/√P_lower - 1/√P_upper) * L when P in range
 *   
 * - token1 needed: Δy = Δ√P * L
 *   = (√P - √P_lower) * L when P in range
 *   = (√P_upper - √P_lower) * L when P >= P_upper (all token1)
 * 
 * When P < sqrtPriceLower: all token0
 * When P > sqrtPriceUpper: all token1
 * 
 * @param sqrtPrice - current sqrtPriceX96
 * @param sqrtPriceLower - sqrtPriceX96 at lower tick
 * @param sqrtPriceUpper - sqrtPriceX96 at upper tick
 * @param liquidity - position liquidity (bigint)
 * @param roundUp - true to round up, false to round down
 * @returns amount0 and amount1 as bigint
 */
export function getTokenAmountsFromLiquidity(
  sqrtPrice: bigint,
  sqrtPriceLower: bigint,
  sqrtPriceUpper: bigint,
  liquidity: bigint,
  roundUp: boolean
): { amount0: bigint; amount1: bigint } {
  
  if (sqrtPriceLower > sqrtPriceUpper) {
    throw new Error('sqrtPriceLower must be <= sqrtPriceUpper');
  }
  
  // Determine which formula to use based on price position
  if (sqrtPrice <= sqrtPriceLower) {
    // Price is at or below range - all token0
    // amount0 = (1/sqrtPriceLower - 1/sqrtPrice) * L
    // = (sqrtPriceLower - sqrtPrice) / (sqrtPrice * sqrtPriceLower) * L
    // 
    // mulDiv(liquidity, sqrtPriceLower - sqrtPrice, sqrtPrice * sqrtPriceLower, roundUp)
    const numer = sqrtPriceLower - sqrtPrice;
    const denom = sqrtPrice * sqrtPriceLower;
    const amount0 = mulDiv(liquidity, numer, denom, roundUp);
    
    return { amount0, amount1: 0n };
    
  } else if (sqrtPrice >= sqrtPriceUpper) {
    // Price is at or above range - all token1
    // amount1 = (sqrtPrice - sqrtPriceUpper) * L
    const amount1 = mulDiv(liquidity, sqrtPrice - sqrtPriceUpper, 1n, roundUp);
    
    return { amount0: 0n, amount1 };
    
  } else {
    // Price is within range - both tokens
    // amount0 = (1/sqrtPrice - 1/sqrtPriceUpper) * L
    // = (sqrtPriceUpper - sqrtPrice) / (sqrtPrice * sqrtPriceUpper) * L
    const numer0 = sqrtPriceUpper - sqrtPrice;
    const denom0 = sqrtPrice * sqrtPriceUpper;
    const amount0 = mulDiv(liquidity, numer0, denom0, roundUp);
    
    // amount1 = (sqrtPrice - sqrtPriceLower) * L
    const amount1 = mulDiv(liquidity, sqrtPrice - sqrtPriceLower, 1n, roundUp);
    
    return { amount0, amount1 };
  }
}

/**
 * Calculate liquidity from token amounts.
 * 
 * Inverse of getTokenAmountsFromLiquidity. Given desired token amounts,
 * finds the maximum liquidity that fits within the range.
 * 
 * When in range:
 * L = amount0 / (1/sqrtPriceUpper - 1/sqrtPrice) 
 *   = amount0 * sqrtPrice * sqrtPriceUpper / (sqrtPriceUpper - sqrtPrice)
 * L = amount1 / (sqrtPrice - sqrtPriceLower)
 * 
 * Take the minimum to ensure both tokens fit.
 * 
 * @param sqrtPrice - current sqrtPriceX96
 * @param sqrtPriceLower - sqrtPriceX96 at lower tick
 * @param sqrtPriceUpper - sqrtPriceX96 at upper tick
 * @param amount0 - desired token0 amount
 * @param amount1 - desired token1 amount
 * @returns liquidity as bigint
 */
export function getLiquidityFromTokenAmounts(
  sqrtPrice: bigint,
  sqrtPriceLower: bigint,
  sqrtPriceUpper: bigint,
  amount0: bigint,
  amount1: bigint
): bigint {
  
  if (sqrtPriceLower > sqrtPriceUpper) {
    throw new Error('sqrtPriceLower must be <= sqrtPriceUpper');
  }
  
  if (sqrtPrice < sqrtPriceLower) {
    // Price below range - all token0 determines liquidity
    // L = amount0 * sqrtPrice * sqrtPriceLower / (sqrtPriceLower - sqrtPrice)
    const numer = amount0 * sqrtPrice * sqrtPriceLower;
    const denom = sqrtPriceLower - sqrtPrice;
    return numer / denom;
    
  } else if (sqrtPrice > sqrtPriceUpper) {
    // Price above range - all token1 determines liquidity
    // L = amount1 / (sqrtPrice - sqrtPriceUpper)
    return amount1 / (sqrtPrice - sqrtPriceUpper);
    
  } else {
    // Price in range - both tokens contribute
    // L = amount0 * sqrtPrice * sqrtPriceUpper / (sqrtPriceUpper - sqrtPrice)
    const liq0 = (amount0 * sqrtPrice * sqrtPriceUpper) / (sqrtPriceUpper - sqrtPrice);
    
    // L = amount1 / (sqrtPrice - sqrtPriceLower)
    const liq1 = amount1 / (sqrtPrice - sqrtPriceLower);
    
    // Take the minimum - the limiting token determines max liquidity
    return liq0 < liq1 ? liq0 : liq1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGE STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine if current tick is inside, below, or above position range.
 * 
 * @param currentTick - current pool tick
 * @param lowerTick - position lower bound
 * @param upperTick - position upper bound
 * @returns range state
 */
export function getRangeState(
  currentTick: number,
  lowerTick: number,
  upperTick: number
): 'in-range' | 'below-range' | 'above-range' {
  if (currentTick < lowerTick) return 'below-range';
  if (currentTick > upperTick) return 'above-range';
  return 'in-range';
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN COMPOSITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate token composition (percentages) of a position's value at a given price.
 * Returns percentage of total value in each token.
 * 
 * @param sqrtPrice - current sqrtPriceX96
 * @param sqrtPriceLower - sqrtPriceX96 at lower tick
 * @param sqrtPriceUpper - sqrtPriceX96 at upper tick
 * @param liquidity - position liquidity
 * @param price0 - price of token0 in terms of token1 (e.g., ETH price in USDC)
 * @param decimals0 - decimals for token0
 * @param decimals1 - decimals for token1
 * @returns percentage of value in token0 and token1
 */
export function getTokenCompositionAtPrice(
  sqrtPrice: bigint,
  sqrtPriceLower: bigint,
  sqrtPriceUpper: bigint,
  liquidity: bigint,
  price0: number,
  decimals0: number,
  decimals1: number
): { percentToken0: number; percentToken1: number } {
  
  const { amount0, amount1 } = getTokenAmountsFromLiquidity(
    sqrtPrice,
    sqrtPriceLower,
    sqrtPriceUpper,
    liquidity,
    false // round down
  );
  
  // Convert to decimal
  const amount0Decimal = Number(amount0) / Math.pow(10, decimals0);
  const amount1Decimal = Number(amount1) / Math.pow(10, decimals1);
  
  // Value in token1 terms
  const value0 = amount0Decimal * price0;
  const value1 = amount1Decimal;
  const totalValue = value0 + value1;
  
  if (totalValue === 0) {
    return { percentToken0: 0, percentToken1: 0 };
  }
  
  return {
    percentToken0: (value0 / totalValue) * 100,
    percentToken1: (value1 / totalValue) * 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POSITION VALUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate total position value at a given price.
 * 
 * @param sqrtPrice - current sqrtPriceX96 (unused for value calc, but kept for API consistency)
 * @param amount0 - token0 amount (bigint, raw)
 * @param amount1 - token1 amount (bigint, raw)
 * @param price0 - price of token0 in terms of token1 (e.g., ETH price in USDC)
 * @param decimals0 - decimals for token0
 * @param decimals1 - decimals for token1
 * @returns total value in token1 terms
 */
export function getPositionValueAtPrice(
  _sqrtPrice: bigint,
  amount0: bigint,
  amount1: bigint,
  price0: number,
  decimals0: number,
  decimals1: number
): number {
  
  // Convert amounts from raw bigint to decimal numbers
  const amount0Decimal = Number(amount0) / Math.pow(10, decimals0);
  const amount1Decimal = Number(amount1) / Math.pow(10, decimals1);
  
  // Value in token1 terms:
  // value = amount0 * price0 + amount1
  const value = amount0Decimal * price0 + amount1Decimal;
  
  return value;
}

/**
 * Calculate position value at a specific price from just liquidity and tick range.
 * Convenience function combining getTokenAmountsFromLiquidity and getPositionValueAtPrice.
 */
export function getPositionValueFromLiquidity(
  sqrtPrice: bigint,
  sqrtPriceLower: bigint,
  sqrtPriceUpper: bigint,
  liquidity: bigint,
  price0: number,
  decimals0: number,
  decimals1: number
): number {
  const { amount0, amount1 } = getTokenAmountsFromLiquidity(
    sqrtPrice,
    sqrtPriceLower,
    sqrtPriceUpper,
    liquidity,
    false
  );
  
  return getPositionValueAtPrice(sqrtPrice, amount0, amount1, price0, decimals0, decimals1);
}
