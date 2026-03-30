/**
 * Scenario Analysis Engine
 * 
 * Generates comprehensive scenario grids for LP strategy analysis.
 * Tests various price points, volumes, and range widths to find
 * optimal strategies.
 * 
 * Scenario types:
 * - Price grid: What if price moves X%?
 * - Volume grid: What if volume changes?
 * - Time horizons: Short vs long term
 * - Range widths: Tight vs wide ranges
 */

import {
  tickToSqrtPrice,
  tickToPrice,
  priceToTick,
  roundTickToFeeTier,
  getTokenAmountsFromLiquidity,
  getRangeState,
  getPositionValueAtPrice,
} from './lp-math';

import { estimateFees, estimateTimeInRange } from './fee-model';

import { LPStrategy } from './lp-vs-hodl';

/**
 * Scenario parameters
 */
export interface ScenarioParams {
  /** Price range: low price as multiplier of entry (e.g., 0.1 = -90%) */
  priceLow: number;
  /** Price range: high price as multiplier of entry (e.g., 4.0 = +300%) */
  priceHigh: number;
  /** Number of price steps in the grid */
  priceSteps: number;
  
  /** Volume assumptions */
  volumeLow: number;     // pessimistic 24h volume
  volumeBase: number;     // expected 24h volume
  volumeHigh: number;    // optimistic 24h volume
  
  /** Time horizons to test (in days) */
  horizonDays: number[];
  
  /** Range widths to test (as decimal, e.g., 0.05 = ±5%) */
  rangeWidths: number[];
}

/**
 * Single scenario result
 */
export interface ScenarioResult {
  /** Current/exit price */
  price: number;
  /** Price move from entry as decimal */
  priceMovePercent: number;
  /** LP position value at this price */
  lpValue: number;
  /** HODL value at this price */
  hodlValue: number;
  /** Estimated fees for this scenario */
  fees: number;
  /** Impermanent loss */
  il: number;
  /** Net return (fees - IL) */
  netReturn: number;
  /** Whether position is in range */
  inRange: boolean;
}

/**
 * Optimal range result
 */
export interface OptimalRangeResult {
  lowerTick: number;
  upperTick: number;
  width: number;           // as decimal (e.g., 0.10 for ±10%)
  expectedInRangePct: number;
}

/**
 * Generate a grid of scenarios across price range.
 * 
 * @param entryPrice - position entry price
 * @param params - scenario parameters
 * @param position - the LP position
 * @returns array of ScenarioResult for each price/volume combination
 */
export function generateScenarioGrid(
  entryPrice: number,
  params: ScenarioParams,
  position: LPStrategy
): ScenarioResult[] {
  
  const {
    priceLow,
    priceHigh,
    priceSteps,
    volumeLow,
    volumeBase,
    volumeHigh,
    horizonDays,
    rangeWidths,
  } = params;
  
  const { 
    liquidity, 
    lowerTick: origLowerTick, 
    upperTick: origUpperTick,
    decimals0,
    decimals1,
    token0Amount,
    token1Amount,
  } = position;
  
  const results: ScenarioResult[] = [];
  
  // Price grid
  const priceMultipliers = generatePriceGrid(priceLow, priceHigh, priceSteps);
  const volumes = [volumeLow, volumeBase, volumeHigh];
  const volumesLabel = ['low', 'base', 'high'];
  
  // Get position entry values
  const sqrtPriceLower = tickToSqrtPrice(origLowerTick);
  const sqrtPriceUpper = tickToSqrtPrice(origUpperTick);
  
  // HODL value at entry
  const hodlEntryValue = token0Amount * entryPrice + token1Amount;
  
  for (const mult of priceMultipliers) {
    const price = entryPrice * mult;
    const priceMovePercent = (mult - 1);
    
    // Calculate LP value at this price
    const tick = Math.round(Math.log(price) / Math.log(1.0001));
    const sqrtPrice = tickToSqrtPrice(tick);
    
    const { amount0, amount1 } = getTokenAmountsFromLiquidity(
      sqrtPrice,
      sqrtPriceLower,
      sqrtPriceUpper,
      liquidity,
      false
    );
    
    const lpValueRaw = getPositionValueAtPrice(
      sqrtPrice,
      amount0,
      amount1,
      price,
      decimals0,
      decimals1
    );
    
    // HODL value at this price
    const hodlValue = token0Amount * price + token1Amount;
    
    // IL
    const il = Math.max(0, hodlValue - lpValueRaw);
    
    // Range state
    const rangeState = getRangeState(tick, origLowerTick, origUpperTick);
    const inRange = rangeState === 'in-range';
    
    // For each volume scenario and time horizon
    for (let v = 0; v < volumes.length; v++) {
      const vol = volumes[v];
      
      for (const days of horizonDays) {
        // Estimate fees
        const feeEst = estimateFees({
          volume24h: vol,
          feeTier: 3000, // default
          liquidity: vol * 10, // rough pool estimate
          yourLiquidity: hodlEntryValue,
          timeHorizonHours: days * 24,
          timeInRangePercent: inRange ? 1 : estimateTimeInRangeAtPrice(
            price,
            entryPrice * (1 - (origUpperTick - origLowerTick) / 2 / 10000),
            entryPrice * (1 + (origUpperTick - origLowerTick) / 2 / 10000),
            0.03, // assume 3% daily vol
            days
          ),
        });
        
        const fees = feeEst.baseVolume;
        const lpValue = lpValueRaw + fees;
        const netReturn = hodlEntryValue > 0 
          ? (lpValue - hodlEntryValue) / hodlEntryValue 
          : 0;
        
        results.push({
          price,
          priceMovePercent,
          lpValue,
          hodlValue,
          fees,
          il,
          netReturn,
          inRange,
        });
      }
    }
  }
  
  return results;
}

/**
 * Generate comprehensive scenario matrix (price × range width).
 * Useful for finding optimal range width for a given volatility.
 * 
 * @param entryPrice - entry price
 * @param params - scenario parameters  
 * @param position - base position (used for fee estimation)
 * @param targetVolatility - expected daily volatility (e.g., 0.03 for 3%)
 * @returns array of results grouped by range width
 */
export function generateRangeWidthAnalysis(
  entryPrice: number,
  params: ScenarioParams,
  position: LPStrategy,
  targetVolatility: number = 0.03
): Array<{
  rangeWidth: number;
  lowerTick: number;
  upperTick: number;
  scenarios: ScenarioResult[];
  expectedReturn: number;
  sharpeRatio: number;
}> {
  
  const { rangeWidths, horizonDays } = params;
  const baseDays = horizonDays[0] || 30;
  
  const results = [];
  
  for (const width of rangeWidths) {
    // Calculate tick range for this width
    // width = (upper - lower) / entry_price
    // tick_delta = log(1+width) / log(1.0001)
    const tickDelta = Math.round(Math.log(1 + width) / Math.log(1.0001));
    const midTick = Math.round(Math.log(entryPrice) / Math.log(1.0001));
    
    const lowerTick = roundTickToFeeTier(midTick - tickDelta / 2, 3000);
    const upperTick = roundTickToFeeTier(midTick + tickDelta / 2, 3000);
    
    // Estimate time in range
    const lowerPrice = tickToPrice(lowerTick);
    const upperPrice = tickToPrice(upperTick);
    const timeInRange = estimateTimeInRange(
      entryPrice,
      lowerPrice,
      upperPrice,
      targetVolatility,
      baseDays
    );
    
    // Generate scenarios for this range
    const scenarios = generateScenarioGrid(
      entryPrice,
      { ...params, rangeWidths: [width] },
      { ...position, lowerTick, upperTick }
    );
    
    // Calculate expected return (average across scenarios)
    const returns = scenarios.map(s => s.netReturn);
    const expectedReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Calculate Sharpe-like ratio (return / stddev of returns)
    const variance = returns.reduce((sum, r) => sum + (r - expectedReturn) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? expectedReturn / stdDev : 0;
    
    results.push({
      rangeWidth: width,
      lowerTick,
      upperTick,
      scenarios,
      expectedReturn,
      sharpeRatio,
    });
  }
  
  return results;
}

/**
 * Find optimal range width based on target in-range probability.
 * 
 * Uses the relationship between range width and time-in-range:
 * - Wider range = more time in range but lower fee capture per unit
 * - Narrower range = less time in range but higher fee density
 * 
 * @param entryPrice - current/entry price
 * @param expectedVolatility - expected daily volatility
 * @param targetInRangePercent - desired probability of being in range (0-1)
 * @param days - time horizon
 * @returns OptimalRangeResult with ticks and width
 */
export function findOptimalRangeWidth(
  entryPrice: number,
  expectedVolatility: number,
  targetInRangePercent: number,
  days: number = 30
): OptimalRangeResult {
  
  // Binary search for optimal width
  let lowWidth = 0.001;   // 0.1%
  let highWidth = 1.0;    // 100%
  
  const maxIterations = 50;
  
  for (let i = 0; i < maxIterations; i++) {
    const midWidth = (lowWidth + highWidth) / 2;
    
    // Calculate tick range for this width
    const tickDelta = Math.round(Math.log(1 + midWidth) / Math.log(1.0001));
    const midTick = Math.round(Math.log(entryPrice) / Math.log(1.0001));
    
    const lowerTick = roundTickToFeeTier(midTick - tickDelta / 2, 3000);
    const upperTick = roundTickToFeeTier(midTick + tickDelta / 2, 3000);
    
    const lowerPrice = tickToPrice(lowerTick);
    const upperPrice = tickToPrice(upperTick);
    
    const actualInRange = estimateTimeInRange(
      entryPrice,
      lowerPrice,
      upperPrice,
      expectedVolatility,
      days
    );
    
    if (Math.abs(actualInRange - targetInRangePercent) < 0.001) {
      // Found good match
      return {
        lowerTick,
        upperTick,
        width: midWidth,
        expectedInRangePct: actualInRange,
      };
    }
    
    if (actualInRange > targetInRangePercent) {
      // Too much in-range time, need wider range
      lowWidth = midWidth;
    } else {
      // Not enough in-range time, need narrower range
      highWidth = midWidth;
    }
  }
  
  // Return best found
  const tickDelta = Math.round(Math.log(1 + highWidth) / Math.log(1.0001));
  const midTick = Math.round(Math.log(entryPrice) / Math.log(1.0001));
  const lowerTick = roundTickToFeeTier(midTick - tickDelta / 2, 3000);
  const upperTick = roundTickToFeeTier(midTick + tickDelta / 2, 3000);
  
  return {
    lowerTick,
    upperTick,
    width: highWidth,
    expectedInRangePct: estimateTimeInRange(
      entryPrice,
      tickToPrice(lowerTick),
      tickToPrice(upperTick),
      expectedVolatility,
      days
    ),
  };
}

/**
 * Calculate PnL scenarios for a given position.
 * Returns detailed breakdown of best/base/worst cases.
 * 
 * @param position - LP position
 * @param entryPrice - entry price
 * @param currentPrice - current price
 * @param daysHeld - days since entry
 * @param volume24h - 24h trading volume
 * @param poolLiquidity - pool total liquidity
 * @returns { best, base, worst } case scenarios
 */
export function calculatePnLScenarios(
  position: LPStrategy,
  entryPrice: number,
  currentPrice: number,
  daysHeld: number,
  volume24h: number,
  poolLiquidity: number
): {
  best: { price: number; lpValue: number; hodlValue: number; fees: number; il: number; net: number };
  base: { price: number; lpValue: number; hodlValue: number; fees: number; il: number; net: number };
  worst: { price: number; lpValue: number; hodlValue: number; fees: number; il: number; net: number };
} {
  
  const { liquidity, lowerTick, upperTick, decimals0, decimals1, token0Amount, token1Amount } = position;
  const hodlValueEntry = token0Amount * entryPrice + token1Amount;
  
  const sqrtPriceLower = tickToSqrtPrice(lowerTick);
  const sqrtPriceUpper = tickToSqrtPrice(upperTick);
  
  // Fee estimation helper
  const calcFees = (price: number, days: number, vol: number) => {
    const tick = Math.round(Math.log(price) / Math.log(1.0001));
    const inRange = getRangeState(tick, lowerTick, upperTick) === 'in-range';
    const timeInRange = inRange ? 1 : estimateTimeInRange(
      price,
      tickToPrice(lowerTick),
      tickToPrice(upperTick),
      vol,
      days
    );
    
    return estimateFees({
      volume24h: vol * volume24h, // vol multiplier
      feeTier: 3000,
      liquidity: poolLiquidity,
      yourLiquidity: hodlValueEntry,
      timeHorizonHours: days * 24,
      timeInRangePercent: timeInRange,
    }).baseVolume;
  };
  
  // Calculate scenario for a given exit price
  const calcScenario = (exitPrice: number, volMultiplier: number = 1) => {
    const tick = Math.round(Math.log(exitPrice) / Math.log(1.0001));
    const sqrtPrice = tickToSqrtPrice(tick);
    
    const { amount0, amount1 } = getTokenAmountsFromLiquidity(
      sqrtPrice,
      sqrtPriceLower,
      sqrtPriceUpper,
      liquidity,
      false
    );
    
    const lpValueRaw = getPositionValueAtPrice(
      sqrtPrice,
      amount0,
      amount1,
      exitPrice,
      decimals0,
      decimals1
    );
    
    const fees = calcFees(exitPrice, daysHeld, volMultiplier);
    const lpValue = lpValueRaw + fees;
    const hodlValue = token0Amount * exitPrice + token1Amount;
    const il = Math.max(0, hodlValue - lpValueRaw);
    const net = lpValue - hodlValueEntry;
    
    return { price: exitPrice, lpValue, hodlValue, fees, il, net };
  };
  
  return {
    best: calcScenario(currentPrice * 1.5, 1.3), // Price up 50%, volume up 30%
    base: calcScenario(currentPrice, 1.0),       // Current price, normal volume
    worst: calcScenario(currentPrice * 0.5, 0.5), // Price down 50%, volume down 50%
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate evenly-spaced price multipliers on a log scale.
 */
function generatePriceGrid(low: number, high: number, steps: number): number[] {
  const logLow = Math.log(low);
  const logHigh = Math.log(high);
  const logStep = (logHigh - logLow) / (steps - 1);
  
  const grid: number[] = [];
  for (let i = 0; i < steps; i++) {
    grid.push(Math.exp(logLow + logStep * i));
  }
  
  return grid;
}

/**
 * Quick estimate of time in range based on price and tick bounds.
 */
function estimateTimeInRangeAtPrice(
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  volatilityDaily: number,
  days: number
): number {
  try {
    return estimateTimeInRange(currentPrice, lowerPrice, upperPrice, volatilityDaily, days);
  } catch {
    return 0.5; // fallback
  }
}

/**
 * Summarize scenario results into key metrics.
 */
export function summarizeScenarios(scenarios: ScenarioResult[]): {
  medianReturn: number;
  bestReturn: number;
  worstReturn: number;
  breakEvenProbability: number;  // probability of positive net return
  var95: number;                  // value at risk (5th percentile)
} {
  
  if (scenarios.length === 0) {
    return {
      medianReturn: 0,
      bestReturn: 0,
      worstReturn: 0,
      breakEvenProbability: 0,
      var95: 0,
    };
  }
  
  const returns = scenarios.map(s => s.netReturn).sort((a, b) => a - b);
  
  const medianIdx = Math.floor(returns.length / 2);
  const varIdx = Math.floor(returns.length * 0.05);
  
  const breakEvenCount = returns.filter(r => r > 0).length;
  
  return {
    medianReturn: returns[medianIdx],
    bestReturn: returns[returns.length - 1],
    worstReturn: returns[0],
    breakEvenProbability: breakEvenCount / returns.length,
    var95: returns[varIdx],
  };
}
