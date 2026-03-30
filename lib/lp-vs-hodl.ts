/**
 * LP vs HODL Comparison
 * 
 * Compares the performance of a Uniswap V3 LP strategy against simple HODLing.
 * 
 * Key metrics:
 * - LP Return: (LP Value + Fees - Entry Value) / Entry Value
 * - HODL Return: (HODL Value - Entry Value) / Entry Value  
 * - Excess Return: LP Return - HODL Return (positive = LP outperformed)
 * - Break-even Fees: Fees needed to exactly cover IL
 * 
 * This helps answer: "Should I LP or just hold?"
 * 
 * Strategy setup:
 * - At entry, convert some capital to LP position
 * - LP position = token0 + token1 locked in Uniswap V3 position
 * - HODL position = same token0 + token1 held in wallet
 * 
 * Both start with same value, diverge over time based on:
 * - Price movement (IL)
 * - Fees earned (LP only)
 * - Gas costs (LP only)
 */

import {
  getTokenAmountsFromLiquidity,
  tickToSqrtPrice,
  getRangeState,
  getTokenCompositionAtPrice,
} from './lp-math';

import { estimateFees } from './fee-model';

/**
 * LP Strategy parameters
 */
export interface LPStrategy {
  token0Amount: number;   // raw amount of token0
  token1Amount: number;   // raw amount of token1
  liquidity: bigint;      // position liquidity
  entryPrice: number;     // token1/token0 at entry
  lowerTick: number;       // position lower bound
  upperTick: number;       // position upper bound
  decimals0: number;      // token0 decimals
  decimals1: number;      // token1 decimals
}

/**
 * HODL position (same initial capital)
 */
export interface HODLPosition {
  token0Amount: number;   // raw amount of token0 (same as LP entry)
  token1Amount: number;   // raw amount of token1 (same as LP entry)
  decimals0: number;
  decimals1: number;
}

/**
 * Comparison result metrics
 */
export interface ComparisonResult {
  /** Entry value in token1 terms */
  entryValue: number;
  
  /** Current values */
  lpValue: number;        // LP position value at current price
  hodlValue: number;       // HODL position value at current price
  
  /** Returns */
  lpReturn: number;       // LP return as decimal (0.05 = 5%)
  hodlReturn: number;     // HODL return as decimal
  excessReturn: number;  // LP return - HODL return
  
  /** Components */
  feesEarned: number;     // fees captured by position
  ilLoss: number;         // impermanent loss (positive = loss)
  netResult: number;      // fees - IL (your actual gain vs HODL)
  
  /** Break-even */
  breakEvenFees: number;   // fees needed to just cover IL
  
  /** Position state */
  inRange: boolean;
  token0Percent: number;  // % of LP value in token0
  token1Percent: number;  // % of LP value in token1
}

/**
 * Compare LP strategy to HODL at current price.
 * 
 * @param strategy - the LP strategy position
 * @param hodl - equivalent HODL position (same initial tokens)
 * @param currentPrice - current price (token1/token0)
 * @param unclaimedFees - fees earned but not yet collected
 * @param gasCosts - gas costs for mint/rebalance (deducted from result)
 * @returns ComparisonResult with all metrics
 */
export function compareToHODL(
  strategy: LPStrategy,
  hodl: HODLPosition,
  currentPrice: number,
  unclaimedFees: number = 0,
  gasCosts: number = 0
): ComparisonResult {
  
  const { 
    token0Amount: strat0, 
    token1Amount: strat1, 
    liquidity, 
    entryPrice, 
    lowerTick, 
    upperTick,
    decimals0,
    decimals1 
  } = strategy;
  
  const { token0Amount: hodl0, token1Amount: hodl1 } = hodl;
  
  // ─── Entry Value ───────────────────────────────────────────────────────────
  // Value at entry price (same for both)
  const entryValue = hodl0 * entryPrice + hodl1;
  
  // ─── HODL Value ─────────────────────────────────────────────────────────────
  // Value if just held (both tokens converted to token1 terms at current price)
  const hodlValue = hodl0 * currentPrice + hodl1;
  
  // ─── LP Value ───────────────────────────────────────────────────────────────
  const sqrtPriceLower = tickToSqrtPrice(lowerTick);
  const sqrtPriceUpper = tickToSqrtPrice(upperTick);
  
  // Get current tick from price
  const currentTick = Math.round(Math.log(currentPrice) / Math.log(1.0001));
  const sqrtPriceCurrent = tickToSqrtPrice(currentTick);
  
  // Get token amounts in position
  const { amount0: lpAmount0, amount1: lpAmount1 } = getTokenAmountsFromLiquidity(
    sqrtPriceCurrent,
    sqrtPriceLower,
    sqrtPriceUpper,
    liquidity,
    false
  );
  
  // LP value at current price
  const lpValueRaw = Number(lpAmount0) / Math.pow(10, decimals0) * currentPrice +
                     Number(lpAmount1) / Math.pow(10, decimals1);
  const lpValue = lpValueRaw + unclaimedFees;
  
  // ─── Range State ─────────────────────────────────────────────────────────────
  const rangeState = getRangeState(currentTick, lowerTick, upperTick);
  const inRange = rangeState === 'in-range';
  
  // ─── Returns ─────────────────────────────────────────────────────────────────
  const lpReturn = entryValue > 0 ? (lpValue - entryValue) / entryValue : 0;
  const hodlReturn = entryValue > 0 ? (hodlValue - entryValue) / entryValue : 0;
  const excessReturn = lpReturn - hodlReturn;
  
  // ─── IL Calculation ──────────────────────────────────────────────────────────
  // IL = HODL value - LP value (positive = loss for LP)
  const ilLoss = Math.max(0, hodlValue - lpValueRaw); // Exclude fees from IL calc
  
  // ─── Net Result ──────────────────────────────────────────────────────────────
  // Net result = fees - IL - gas
  const netResult = unclaimedFees - ilLoss - gasCosts;
  
  // ─── Break-even Fees ─────────────────────────────────────────────────────────
  // Fees needed to just cover IL (make LP = HODL)
  const breakEvenFees = ilLoss;
  
  // ─── Token Composition ───────────────────────────────────────────────────────
  const composition = getTokenCompositionAtPrice(
    sqrtPriceCurrent,
    sqrtPriceLower,
    sqrtPriceUpper,
    liquidity,
    currentPrice,
    decimals0,
    decimals1
  );
  
  return {
    entryValue,
    lpValue,
    hodlValue,
    lpReturn,
    hodlReturn,
    excessReturn,
    feesEarned: unclaimedFees,
    ilLoss,
    netResult,
    breakEvenFees,
    inRange,
    token0Percent: composition.percentToken0,
    token1Percent: composition.percentToken1,
  };
}

/**
 * Find crossover prices where LP becomes better than HODL.
 * 
 * For a given fee earning rate, find the price where accumulated fees
 * offset IL enough to outperform HODL.
 * 
 * @param entryPrice - entry price
 * @param lowerTick - position lower bound
 * @param upperTick - position upper bound
 * @param dailyFeesPercent - daily fees as % of position value (e.g., 0.001 for 0.1%)
 * @param days - number of days to project
 * @returns { upCrossover, downCrossover } prices where LP beats HODL
 */
export function findCrossoverPrices(
  entryPrice: number,
  lowerTick: number,
  upperTick: number,
  dailyFeesPercent: number,
  days: number = 30
): { upCrossover: number; downCrossover: number } {
  
  // Fee accumulation over time
  const totalFeesPercent = dailyFeesPercent * days;
  
  // IL at different price levels (simplified)
  // IL ≈ 2*sqrt(r)/(1+r) - 1 where r = P/P_entry for full range
  const calcIL = (price: number): number => {
    const r = price / entryPrice;
    const fullRangeIL = 2 * Math.sqrt(r) / (1 + r) - 1;
    return Math.abs(fullRangeIL);
  };
  
  // Binary search for up crossover (price goes up)
  let upLow = entryPrice;
  let upHigh = entryPrice * 10;
  for (let i = 0; i < 50; i++) {
    const mid = (upLow + upHigh) / 2;
    const il = calcIL(mid);
    if (il < totalFeesPercent) {
      upHigh = mid;
    } else {
      upLow = mid;
    }
  }
  
  // Binary search for down crossover (price goes down)
  let downLow = entryPrice * 0.001;
  let downHigh = entryPrice;
  for (let i = 0; i < 50; i++) {
    const mid = (downLow + downHigh) / 2;
    const il = calcIL(mid);
    if (il < totalFeesPercent) {
      downLow = mid;
    } else {
      downHigh = mid;
    }
  }
  
  return { upCrossover: upHigh, downCrossover: downLow };
}

/**
 * Generate a summary verdict for LP vs HODL.
 */
export function getVerdict(result: ComparisonResult): {
  verdict: 'LP WIN' | 'HODL WIN' | 'TIE';
  reason: string;
} {
  const { netResult, excessReturn, feesEarned, ilLoss, inRange } = result;
  
  if (Math.abs(netResult) < 0.001) {
    return { verdict: 'TIE', reason: 'LP and HODL performed equally' };
  }
  
  if (netResult > 0) {
    let reason = `LP outperformed by ${(excessReturn * 100).toFixed(2)}%`;
    if (!inRange) {
      reason += ' (out of range - fees protecting against IL)';
    }
    return { verdict: 'LP WIN', reason };
  } else {
    let reason = `HODL outperformed by ${(-excessReturn * 100).toFixed(2)}%`;
    if (ilLoss > feesEarned) {
      reason += ` (IL (${ilLoss.toFixed(4)}) > fees (${feesEarned.toFixed(4)}))`;
    }
    return { verdict: 'HODL WIN', reason };
  }
}

/**
 * Simulate LP vs HODL over time with fee accumulation.
 */
export function simulateLPvsHODL(
  strategy: LPStrategy,
  hodl: HODLPosition,
  pricePath: number[],
  dailyVolume: number,
  poolLiquidity: number,
  feeTier: number
): Array<{
  day: number;
  price: number;
  lpValue: number;
  hodlValue: number;
  cumulativeFees: number;
  cumulativeIL: number;
  excessReturn: number;
}> {
  
  const { lowerTick, upperTick, liquidity, decimals0, decimals1, entryPrice } = strategy;
  const sqrtPriceLower = tickToSqrtPrice(lowerTick);
  const sqrtPriceUpper = tickToSqrtPrice(upperTick);
  
  // Position value at entry
  const positionValue = hodl.token0Amount * entryPrice + hodl.token1Amount;
  
  // Daily fees estimate
  const dailyFees = estimateFees({
    volume24h: dailyVolume,
    feeTier,
    liquidity: poolLiquidity,
    yourLiquidity: positionValue,
    timeHorizonHours: 24,
    timeInRangePercent: 0.5,
  }).baseVolume;
  
  const snapshots = [];
  let cumulativeFees = 0;
  
  // Starting point
  const startHodlValue = hodl.token0Amount * pricePath[0] + hodl.token1Amount;
  const startLpValue = startHodlValue;
  
  for (let i = 0; i < pricePath.length; i++) {
    const price = pricePath[i];
    const day = i;
    
    // HODL value
    const hodlValue = hodl.token0Amount * price + hodl.token1Amount;
    
    // LP value
    const tick = Math.round(Math.log(price) / Math.log(1.0001));
    const sqrtPrice = tickToSqrtPrice(tick);
    
    const { amount0, amount1 } = getTokenAmountsFromLiquidity(
      sqrtPrice,
      sqrtPriceLower,
      sqrtPriceUpper,
      liquidity,
      false
    );
    
    const lpValueRaw = Number(amount0) / Math.pow(10, decimals0) * price +
                       Number(amount1) / Math.pow(10, decimals1);
    
    // Accumulate fees if in range
    const rangeState = getRangeState(tick, lowerTick, upperTick);
    if (rangeState === 'in-range') {
      cumulativeFees += dailyFees;
    }
    
    const lpValue = lpValueRaw + cumulativeFees;
    
    // IL calculation
    const il = Math.max(0, hodlValue - lpValueRaw);
    
    snapshots.push({
      day,
      price,
      lpValue,
      hodlValue,
      cumulativeFees,
      cumulativeIL: il,
      excessReturn: (lpValue - startLpValue) - (hodlValue - startHodlValue),
    });
  }
  
  return snapshots;
}
