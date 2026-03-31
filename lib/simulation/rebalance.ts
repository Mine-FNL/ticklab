/**
 * Rebalance Logic for Uniswap V3 LP Strategies
 * 
 * This module provides various rebalance strategies for Uniswap V3 positions:
 * - Periodic rebalancing (time-based)
 * - Threshold rebalancing (price-based)
 * - Volatility-triggered rebalancing
 * - Range-bound rebalancing
 * 
 * Each strategy helps maintain optimal position parameters as market
 * conditions change, potentially improving returns and reducing IL.
 * 
 * @module simulation/rebalance
 * @author UniV3 Strategy Lab
 */

import {
  priceToTick,
  tickToPrice,
  getNearestUsableTick,
  getTickSpacingForFeeTier,
  getRangeStatus
} from '../univ3/math';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of a rebalance check
 */
export interface RebalanceCheck {
  /** Whether a rebalance should be executed */
  shouldRebalance: boolean;
  
  /** Reason for the rebalance decision */
  reason?: string;
  
  /** Suggested new lower price (if rebalancing) */
  newLowerPrice?: number;
  
  /** Suggested new upper price (if rebalancing) */
  newUpperPrice?: number;
}

/**
 * Parameters for periodic rebalancing
 */
export interface PeriodicRebalanceParams {
  /** Last rebalance timestamp (Unix seconds) */
  lastRebalanceTime: number;
  
  /** Current timestamp (Unix seconds) */
  currentTime: number;
  
  /** Rebalance period in days */
  periodDays: number;
  
  /** Current price (optional, for new range calculation) */
  currentPrice?: number;
  
  /** Current range width (optional, for new range calculation) */
  currentRangeWidth?: number;
}

/**
 * Parameters for threshold rebalancing
 */
export interface ThresholdRebalanceParams {
  /** Current market price */
  currentPrice: number;
  
  /** Price at last rebalance */
  entryPrice: number;
  
  /** Current lower price bound */
  lowerPrice: number;
  
  /** Current upper price bound */
  upperPrice: number;
  
  /** Price change threshold (e.g., 0.1 for 10%) */
  threshold: number;
  
  /** Whether to maintain range width (default true) */
  maintainWidth?: boolean;
}

/**
 * Parameters for volatility-triggered rebalancing
 */
export interface VolatilityRebalanceParams {
  /** Recent price history for volatility calculation */
  priceHistory: number[];
  
  /** Volatility threshold (annualized, e.g., 0.8 for 80%) */
  volatilityThreshold: number;
  
  /** Current price */
  currentPrice: number;
  
  /** Current lower price bound */
  lowerPrice: number;
  
  /** Current upper price bound */
  upperPrice: number;
  
  /** Minimum time between rebalances in days (default 1) */
  minDaysBetweenRebalances?: number;
  
  /** Last rebalance timestamp (Unix seconds) */
  lastRebalanceTime?: number;
  
  /** Current timestamp (Unix seconds) */
  currentTime?: number;
}

// =============================================================================
// PERIODIC REBALANCING
// =============================================================================

/**
 * Checks if periodic rebalancing should be triggered
 * 
 * Periodic rebalancing executes at fixed time intervals regardless
 * of price movement. This is useful for maintaining a consistent
 * position structure.
 * 
 * @param params - Periodic rebalance parameters
 * @returns Rebalance check result
 * 
 * @example
 * ```typescript
 * const check = checkPeriodicRebalance({
 *   lastRebalanceTime: 1609459200,
 *   currentTime: 1612137600, // 31 days later
 *   periodDays: 30,
 *   currentPrice: 2200,
 *   currentRangeWidth: 0.2
 * });
 * // Returns { shouldRebalance: true, ... }
 * ```
 */
export function checkPeriodicRebalance(
  params: PeriodicRebalanceParams
): RebalanceCheck {
  const {
    lastRebalanceTime,
    currentTime,
    periodDays,
    currentPrice,
    currentRangeWidth
  } = params;

  const secondsInDay = 24 * 60 * 60;
  const daysSinceRebalance = (currentTime - lastRebalanceTime) / secondsInDay;

  if (daysSinceRebalance >= periodDays) {
    // Calculate new range if price is provided
    let newLowerPrice: number | undefined;
    let newUpperPrice: number | undefined;

    if (currentPrice && currentRangeWidth) {
      const halfWidth = currentRangeWidth / 2;
      newLowerPrice = currentPrice * (1 - halfWidth);
      newUpperPrice = currentPrice * (1 + halfWidth);
    }

    return {
      shouldRebalance: true,
      reason: `Periodic rebalance: ${daysSinceRebalance.toFixed(1)} days since last rebalance`,
      newLowerPrice,
      newUpperPrice
    };
  }

  return {
    shouldRebalance: false,
    reason: `Next rebalance in ${(periodDays - daysSinceRebalance).toFixed(1)} days`
  };
}

// =============================================================================
// THRESHOLD REBALANCING
// =============================================================================

/**
 * Checks if threshold rebalancing should be triggered
 * 
 * Threshold rebalancing executes when price moves beyond a specified
 * percentage from the entry price or position bounds.
 * 
 * @param params - Threshold rebalance parameters
 * @returns Rebalance check result
 * 
 * @example
 * ```typescript
 * const check = checkThresholdRebalance({
 *   currentPrice: 2300,
 *   entryPrice: 2000,
 *   lowerPrice: 1800,
 *   upperPrice: 2400,
 *   threshold: 0.15 // 15%
 * });
 * // Returns { shouldRebalance: true, ... } if price moved >15%
 * ```
 */
export function checkThresholdRebalance(
  params: ThresholdRebalanceParams
): RebalanceCheck {
  const {
    currentPrice,
    entryPrice,
    lowerPrice,
    upperPrice,
    threshold,
    maintainWidth = true
  } = params;

  // Calculate price change from entry
  const priceChange = Math.abs(currentPrice - entryPrice) / entryPrice;

  // Check if price is near range boundaries
  const distanceToLower = (currentPrice - lowerPrice) / lowerPrice;
  const distanceToUpper = (upperPrice - currentPrice) / currentPrice;
  const nearBoundary = distanceToLower < threshold / 2 || distanceToUpper < threshold / 2;

  if (priceChange >= threshold || nearBoundary) {
    // Calculate new range
    const currentRangeWidth = (upperPrice - lowerPrice) / lowerPrice;
    const newWidth = maintainWidth ? currentRangeWidth : threshold * 2;
    const halfWidth = newWidth / 2;

    const newLowerPrice = currentPrice * (1 - halfWidth);
    const newUpperPrice = currentPrice * (1 + halfWidth);

    let reason: string;
    if (priceChange >= threshold) {
      reason = `Price moved ${(priceChange * 100).toFixed(1)}% from entry (threshold: ${(threshold * 100).toFixed(1)}%)`;
    } else {
      reason = `Price near range boundary`;
    }

    return {
      shouldRebalance: true,
      reason,
      newLowerPrice,
      newUpperPrice
    };
  }

  return {
    shouldRebalance: false,
    reason: `Price change ${(priceChange * 100).toFixed(1)}% below threshold ${(threshold * 100).toFixed(1)}%`
  };
}

// =============================================================================
// VOLATILITY-TRIGGERED REBALANCING
// =============================================================================

/**
 * Checks if volatility-triggered rebalancing should occur
 * 
 * Volatility-triggered rebalancing executes when realized volatility
 * exceeds a threshold, potentially widening the position range to
 * reduce the probability of going out of range.
 * 
 * @param params - Volatility rebalance parameters
 * @returns Rebalance check result
 * 
 * @example
 * ```typescript
 * const check = checkVolatilityRebalance({
 *   priceHistory: [2000, 2050, 1980, 2100, 1950, 2200, 2150],
 *   volatilityThreshold: 0.8,
 *   currentPrice: 2150,
 *   lowerPrice: 1800,
 *   upperPrice: 2400
 * });
 * ```
 */
export function checkVolatilityRebalance(
  params: VolatilityRebalanceParams
): RebalanceCheck {
  const {
    priceHistory,
    volatilityThreshold,
    currentPrice,
    lowerPrice,
    upperPrice,
    minDaysBetweenRebalances = 1,
    lastRebalanceTime,
    currentTime
  } = params;

  // Check minimum time between rebalances
  if (lastRebalanceTime && currentTime) {
    const daysSinceRebalance = (currentTime - lastRebalanceTime) / (24 * 60 * 60);
    if (daysSinceRebalance < minDaysBetweenRebalances) {
      return {
        shouldRebalance: false,
        reason: `Minimum ${minDaysBetweenRebalances} days between rebalances`
      };
    }
  }

  // Calculate realized volatility
  if (priceHistory.length < 7) {
    return {
      shouldRebalance: false,
      reason: 'Insufficient price history for volatility calculation'
    };
  }

  const volatility = calculateRealizedVolatility(priceHistory);

  if (volatility >= volatilityThreshold) {
    // Widen the range based on volatility
    // Higher volatility = wider range
    const volatilityMultiplier = Math.min(3, 1 + volatility / volatilityThreshold);
    const currentRangeWidth = (upperPrice - lowerPrice) / lowerPrice;
    const newWidth = currentRangeWidth * volatilityMultiplier;
    const halfWidth = newWidth / 2;

    const newLowerPrice = currentPrice * (1 - halfWidth);
    const newUpperPrice = currentPrice * (1 + halfWidth);

    return {
      shouldRebalance: true,
      reason: `Volatility ${(volatility * 100).toFixed(1)}% exceeded threshold ${(volatilityThreshold * 100).toFixed(1)}%`,
      newLowerPrice,
      newUpperPrice
    };
  }

  return {
    shouldRebalance: false,
    reason: `Volatility ${(volatility * 100).toFixed(1)}% below threshold ${(volatilityThreshold * 100).toFixed(1)}%`
  };
}

/**
 * Calculates realized volatility from price history
 * 
 * @param prices - Array of prices
 * @returns Annualized volatility
 */
function calculateRealizedVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  // Calculate log returns
  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    logReturns.push(Math.log(prices[i] / prices[i - 1]));
  }

  // Calculate standard deviation
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / logReturns.length;
  const dailyVol = Math.sqrt(variance);

  // Annualize (assuming daily data)
  return dailyVol * Math.sqrt(365);
}

// =============================================================================
// ADVANCED REBALANCE STRATEGIES
// =============================================================================

/**
 * Parameters for range-bound rebalancing
 */
export interface RangeBoundRebalanceParams {
  /** Current price */
  currentPrice: number;
  
  /** Current lower bound */
  lowerPrice: number;
  
  /** Current upper bound */
  upperPrice: number;
  
  /** Distance to boundary that triggers rebalance (e.g., 0.05 for 5%) */
  boundaryThreshold: number;
  
  /** Whether to center on current price */
  centerOnPrice: boolean;
}

/**
 * Checks if range-bound rebalancing should occur
 * 
 * This strategy rebalances when price approaches the boundaries
 * of the current range, helping to maintain the position in range.
 * 
 * @param params - Range-bound rebalance parameters
 * @returns Rebalance check result
 */
export function checkRangeBoundRebalance(
  params: RangeBoundRebalanceParams
): RebalanceCheck {
  const {
    currentPrice,
    lowerPrice,
    upperPrice,
    boundaryThreshold,
    centerOnPrice
  } = params;

  // Calculate distances to boundaries
  const distanceToLower = (currentPrice - lowerPrice) / (upperPrice - lowerPrice);
  const distanceToUpper = (upperPrice - currentPrice) / (upperPrice - lowerPrice);

  // Check if near boundary
  const nearLower = distanceToLower <= boundaryThreshold;
  const nearUpper = distanceToUpper <= boundaryThreshold;

  if (nearLower || nearUpper) {
    const currentRangeWidth = (upperPrice - lowerPrice) / lowerPrice;
    const halfWidth = currentRangeWidth / 2;

    let newLowerPrice: number;
    let newUpperPrice: number;

    if (centerOnPrice) {
      // Center new range on current price
      newLowerPrice = currentPrice * (1 - halfWidth);
      newUpperPrice = currentPrice * (1 + halfWidth);
    } else {
      // Shift range to maintain distance
      if (nearLower) {
        newLowerPrice = currentPrice * (1 - boundaryThreshold);
        newUpperPrice = newLowerPrice * (1 + currentRangeWidth);
      } else {
        newUpperPrice = currentPrice * (1 + boundaryThreshold);
        newLowerPrice = newUpperPrice / (1 + currentRangeWidth);
      }
    }

    return {
      shouldRebalance: true,
      reason: `Price near ${nearLower ? 'lower' : 'upper'} boundary`,
      newLowerPrice,
      newUpperPrice
    };
  }

  return {
    shouldRebalance: false,
    reason: `Price comfortably within range`
  };
}

/**
 * Parameters for IL-protection rebalancing
 */
export interface ILProtectionRebalanceParams {
  /** Entry price */
  entryPrice: number;
  
  /** Current price */
  currentPrice: number;
  
  /** Current IL as percentage (negative = loss) */
  currentIL: number;
  
  /** IL threshold that triggers rebalance (e.g., -0.02 for 2% loss) */
  ilThreshold: number;
  
  /** Current lower bound */
  lowerPrice: number;
  
  /** Current upper bound */
  upperPrice: number;
}

/**
 * Checks if IL-protection rebalancing should occur
 * 
 * This strategy rebalances when impermanent loss exceeds a threshold,
 * potentially narrowing the range to reduce further IL exposure.
 * 
 * @param params - IL-protection rebalance parameters
 * @returns Rebalance check result
 */
export function checkILProtectionRebalance(
  params: ILProtectionRebalanceParams
): RebalanceCheck {
  const {
    entryPrice,
    currentPrice,
    currentIL,
    ilThreshold,
    lowerPrice,
    upperPrice
  } = params;

  // Check if IL exceeds threshold (remember IL is negative)
  if (currentIL <= ilThreshold) {
    // Narrow the range to reduce IL exposure
    const currentRangeWidth = (upperPrice - lowerPrice) / lowerPrice;
    const newWidth = currentRangeWidth * 0.7; // Narrow by 30%
    const halfWidth = newWidth / 2;

    const newLowerPrice = currentPrice * (1 - halfWidth);
    const newUpperPrice = currentPrice * (1 + halfWidth);

    return {
      shouldRebalance: true,
      reason: `IL ${(currentIL * 100).toFixed(2)}% exceeded threshold ${(ilThreshold * 100).toFixed(2)}%`,
      newLowerPrice,
      newUpperPrice
    };
  }

  return {
    shouldRebalance: false,
    reason: `IL ${(currentIL * 100).toFixed(2)}% within threshold ${(ilThreshold * 100).toFixed(2)}%`
  };
}

// =============================================================================
// REBALANCE EXECUTION
// =============================================================================

/**
 * Calculates gas cost for a rebalance
 * 
 * @param gasCostGwei - Current gas price in gwei
 * @param gasUnits - Gas units required (default 250000)
 * @param ethPriceUSD - ETH price in USD
 * @returns Gas cost in USD
 */
export function calculateRebalanceGasCost(
  gasCostGwei: number,
  gasUnits: number = 250000,
  ethPriceUSD: number = 3000
): number {
  const gasCostETH = (gasCostGwei * gasUnits) / 1e9;
  return gasCostETH * ethPriceUSD;
}

/**
 * Determines optimal rebalance strategy based on market conditions
 * 
 * @param marketConditions - Current market conditions
 * @returns Recommended rebalance strategy
 */
export function recommendRebalanceStrategy(marketConditions: {
  volatility30d: number;
  trendDirection: 'up' | 'down' | 'sideways';
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  expectedHoldingPeriod: number; // days
}): {
  strategy: 'periodic' | 'threshold' | 'volatility' | 'range-bound';
  params: Record<string, number>;
  rationale: string;
} {
  const { volatility30d, trendDirection, volumeTrend, expectedHoldingPeriod } = marketConditions;

  // High volatility: use volatility-triggered
  if (volatility30d > 1.0) {
    return {
      strategy: 'volatility',
      params: { volatilityThreshold: volatility30d * 0.8 },
      rationale: 'High volatility environment requires dynamic range adjustment'
    };
  }

  // Strong trend: use threshold
  if (trendDirection !== 'sideways' && volumeTrend === 'increasing') {
    return {
      strategy: 'threshold',
      params: { threshold: 0.15 },
      rationale: 'Strong trending market benefits from price-threshold rebalancing'
    };
  }

  // Short holding period: use range-bound
  if (expectedHoldingPeriod < 7) {
    return {
      strategy: 'range-bound',
      params: { boundaryThreshold: 0.1 },
      rationale: 'Short-term position benefits from tight range management'
    };
  }

  // Default: periodic
  return {
    strategy: 'periodic',
    params: { periodDays: Math.min(30, expectedHoldingPeriod / 3) },
    rationale: 'Periodic rebalancing provides consistent position management'
  };
}

// =============================================================================
// REBALANCE COMPARISON
// =============================================================================

/**
 * Compares different rebalance strategies for a price path
 * 
 * @param pricePath - Array of prices
 * @param initialRange - Initial position range
 * @returns Comparison of strategy outcomes
 */
export function compareRebalanceStrategies(
  pricePath: number[],
  initialRange: { lower: number; upper: number }
): Array<{
  strategy: string;
  rebalances: number;
  timeInRange: number;
  finalRange: { lower: number; upper: number };
}> {
  const strategies = [
    { name: 'None', check: () => ({ shouldRebalance: false } as RebalanceCheck) },
    { 
      name: 'Threshold (10%)', 
      check: (i: number, currentRange: typeof initialRange) => 
        checkThresholdRebalance({
          currentPrice: pricePath[i],
          entryPrice: pricePath[0],
          lowerPrice: currentRange.lower,
          upperPrice: currentRange.upper,
          threshold: 0.1
        })
    },
    {
      name: 'Range-Bound (5%)',
      check: (i: number, currentRange: typeof initialRange) =>
        checkRangeBoundRebalance({
          currentPrice: pricePath[i],
          lowerPrice: currentRange.lower,
          upperPrice: currentRange.upper,
          boundaryThreshold: 0.05,
          centerOnPrice: true
        })
    }
  ];

  return strategies.map(strategy => {
    let currentRange = { ...initialRange };
    let rebalances = 0;
    let inRangeCount = 0;

    for (let i = 0; i < pricePath.length; i++) {
      const price = pricePath[i];
      
      // Check if in range
      if (price >= currentRange.lower && price <= currentRange.upper) {
        inRangeCount++;
      }

      // Check rebalance
      const check = strategy.check(i, currentRange);
      if (check.shouldRebalance && check.newLowerPrice && check.newUpperPrice) {
        currentRange = {
          lower: check.newLowerPrice,
          upper: check.newUpperPrice
        };
        rebalances++;
      }
    }

    return {
      strategy: strategy.name,
      rebalances,
      timeInRange: inRangeCount / pricePath.length,
      finalRange: currentRange
    };
  });
}
