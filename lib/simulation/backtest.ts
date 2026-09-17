/**
 * Backtest Engine for Uniswap V3 LP Strategies
 * 
 * This module provides historical backtesting functionality for Uniswap V3
 * LP positions. It simulates how a position would have performed over
 * historical price data, including fees, impermanent loss, and rebalancing.
 * 
 * Features:
 * - Historical position simulation
 * - Multiple rebalance strategies (periodic, threshold, volatility)
 * - Fee accrual estimation
 * - Drawdown analysis
 * - Best/worst window identification
 * 
 * @module simulation/backtest
 * @author UniV3 Strategy Lab
 */

import {
  calculatePositionEntry,
  calculateBalancedEntry
} from '../univ3/position';
import {
  calculateIL,
  calculateHODLValue
} from '../univ3/il';
import {
  estimateFees,
  calculateFeeAPR
} from '../univ3/fees';
import {
  getAmountsForLiquidity,
  priceToSqrtPriceX96,
  getRangeStatus,
  tickToPrice,
  priceToTick
} from '../univ3/math';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Historical price data point
 */
export interface PriceDataPoint {
  /** Timestamp (Unix seconds) */
  timestamp: number;
  
  /** Price (token1 per token0) */
  price: number;
  
  /** Trading volume in USD */
  volumeUSD: number;
}

/**
 * Parameters for backtest
 */
export interface BacktestParams {
  /** Historical price and volume data */
  priceHistory: PriceDataPoint[];
  
  /** Entry timestamp */
  entryTimestamp: number;
  
  /** Lower price bound */
  lowerPrice: number;
  
  /** Upper price bound */
  upperPrice: number;
  
  /** Deposit amount */
  depositAmount: number;
  
  /** Deposit token type */
  depositToken: 'token0' | 'token1' | 'usd';
  
  /** Rebalance mode */
  rebalanceMode: 'none' | 'periodic' | 'threshold' | 'volatility';
  
  /** Rebalance parameters */
  rebalanceParams?: {
    /** Period in days (for periodic) */
    periodDays?: number;
    
    /** Price threshold (for threshold, e.g., 0.1 for 10%) */
    priceThreshold?: number;
    
    /** Volatility threshold (for volatility-triggered) */
    volatilityThreshold?: number;
  };
  
  /** Gas cost in gwei */
  gasCostGwei: number;
  
  /** Gas units per rebalance transaction */
  gasUnitsPerRebalance: number;
  
  /** Token decimals */
  token0Decimals: number;
  
  /** Token decimals */
  token1Decimals: number;
  
  /** Fee tier in basis points */
  feeTier: number;
}

/**
 * Backtest result
 */
export interface BacktestResult {
  /** Total return (decimal, e.g., 0.15 for 15%) */
  totalReturn: number;
  
  /** HODL benchmark return */
  hodlReturn: number;
  
  /** Excess return vs HODL */
  excessReturn: number;
  
  /** Total fees earned in USD */
  totalFees: number;
  
  /** Realized impermanent loss in USD */
  realizedIL: number;
  
  /** Total gas costs in USD */
  gasCosts: number;
  
  /** Number of rebalances executed */
  rebalanceCount: number;
  
  /** Fraction of time position was in range (0-1) */
  timeInRange: number;
  
  /** Number of periods position was out of range */
  periodsOutOfRange: number;
  
  /** Equity curve over time */
  equityCurve: Array<{
    timestamp: number;
    lpValue: number;
    hodlValue: number;
    fees: number;
  }>;
  
  /** Drawdowns over time */
  drawdowns: Array<{
    timestamp: number;
    drawdown: number;
  }>;
  
  /** Best performing window */
  bestWindow: {
    start: number;
    end: number;
    return: number;
  };
  
  /** Worst performing window */
  worstWindow: {
    start: number;
    end: number;
    return: number;
  };
}

// =============================================================================
// MAIN BACKTEST FUNCTION
// =============================================================================

/**
 * Runs a historical backtest for a Uniswap V3 LP position
 * 
 * @param params - Backtest parameters
 * @returns Backtest results
 * 
 * @example
 * ```typescript
 * const result = runBacktest({
 *   priceHistory: [
 *     { timestamp: 1609459200, price: 2000, volumeUSD: 1000000 },
 *     { timestamp: 1609545600, price: 2050, volumeUSD: 1200000 },
 *     // ... more data
 *   ],
 *   entryTimestamp: 1609459200,
 *   lowerPrice: 1800,
 *   upperPrice: 2400,
 *   depositAmount: 10000,
 *   depositToken: 'usd',
 *   rebalanceMode: 'threshold',
 *   rebalanceParams: { priceThreshold: 0.15 },
 *   gasCostGwei: 20,
 *   gasUnitsPerRebalance: 250000,
 *   token0Decimals: 18,
 *   token1Decimals: 6,
 *   feeTier: 500
 * });
 * ```
 */
export function runBacktest(params: BacktestParams): BacktestResult {
  const {
    priceHistory,
    entryTimestamp,
    lowerPrice,
    upperPrice,
    depositAmount,
    depositToken,
    rebalanceMode,
    rebalanceParams,
    gasCostGwei,
    gasUnitsPerRebalance,
    token0Decimals,
    token1Decimals,
    feeTier
  } = params;

  // Find entry index
  const entryIndex = priceHistory.findIndex(p => p.timestamp >= entryTimestamp);
  if (entryIndex === -1) {
    throw new Error('Entry timestamp not found in price history');
  }

  // Get entry price
  const entryPrice = priceHistory[entryIndex].price;

  // Calculate initial position
  const entry = calculatePositionEntry({
    depositAmount,
    depositToken,
    currentPrice: entryPrice,
    lowerPrice,
    upperPrice,
    token0Decimals,
    token1Decimals
  });

  // Initialize tracking variables
  let currentLiquidity = entry.liquidity;
  let currentLowerPrice = lowerPrice;
  let currentUpperPrice = upperPrice;
  let currentToken0Amount = entry.token0Amount;
  let currentToken1Amount = entry.token1Amount;
  
  let totalFees = 0;
  let gasCosts = 0;
  let rebalanceCount = 0;
  let inRangePeriods = 0;
  let outOfRangePeriods = 0;
  
  const equityCurve: BacktestResult['equityCurve'] = [];
  const drawdowns: BacktestResult['drawdowns'] = [];
  let peakValue = entry.valueUSD;

  // Track rebalance timing
  let lastRebalanceTime = entryTimestamp;
  let lastRebalancePrice = entryPrice;
  const priceWindow: number[] = [];

  // Iterate through price history
  for (let i = entryIndex; i < priceHistory.length; i++) {
    const dataPoint = priceHistory[i];
    const currentPrice = dataPoint.price;
    
    // Check if in range
    const inRange = currentPrice >= currentLowerPrice && currentPrice <= currentUpperPrice;
    
    if (inRange) {
      inRangePeriods++;
      
      // Accrue fees (simplified model).
//   feeShare = 0.001 represents 0.1% of the pool's fees — a typical
//   assumption for a small LP (e.g. $10k into a $10M pool). The previous
//   default of 0.01 (1%) was a 10× over-projection for most real LP sizes
//   and inflated simulator projections by an order of magnitude on
//   mainstream pools (verified by `npm run validate:northstar`).
//   See NORTH_STAR_REPORT.md → "Fee-share default" for the numbers.
      const dailyFeeRate = feeTier / 10000;
      const feeShare = 0.001; // Default 0.1% of pool — typical for a small LP.
      const dailyFees = dataPoint.volumeUSD * dailyFeeRate * feeShare;
      totalFees += dailyFees;
    } else {
      outOfRangePeriods++;
    }

    // Calculate current position value
    const lpValue = currentToken0Amount * currentPrice + currentToken1Amount + totalFees;
    
    // Calculate HODL value
    const hodlValue = calculateHODLValue(
      entry.token0Amount,
      entry.token1Amount,
      entryPrice,
      currentPrice,
      depositToken
    );

    // Update equity curve
    equityCurve.push({
      timestamp: dataPoint.timestamp,
      lpValue,
      hodlValue,
      fees: totalFees
    });

    // Calculate drawdown
    if (lpValue > peakValue) {
      peakValue = lpValue;
    }
    // Guard divide-by-zero when peakValue is 0 (e.g. zero-liquidity edge cases).
    const drawdown = peakValue > 0 ? (peakValue - lpValue) / peakValue : 0;
    drawdowns.push({
      timestamp: dataPoint.timestamp,
      drawdown
    });

    // Check for rebalance
    const shouldRebalance = checkRebalance(
      rebalanceMode,
      {
        currentTime: dataPoint.timestamp,
        lastRebalanceTime,
        currentPrice,
        lastRebalancePrice,
        currentLowerPrice,
        currentUpperPrice,
        priceWindow,
        rebalanceParams
      }
    );

    if (shouldRebalance) {
      // Execute rebalance
      const gasCostETH = (gasCostGwei * gasUnitsPerRebalance) / 1e9;
      const gasCostUSD = gasCostETH * 3000; // Assume ETH price
      gasCosts += gasCostUSD;

      // Reset position around current price. Guard against zero or negative
      // currentLowerPrice so a degenerate state doesn't blow up the loop.
      const rangeWidth = currentLowerPrice > 0
        ? (currentUpperPrice - currentLowerPrice) / currentLowerPrice
        : 0.2; // fallback to a ±10% range when bounds degenerate
      currentLowerPrice = currentPrice * (1 - rangeWidth / 2);
      currentUpperPrice = currentPrice * (1 + rangeWidth / 2);

      // Recalculate position
      const rebalanceEntry = calculatePositionEntry({
        depositAmount: lpValue - gasCostUSD,
        depositToken: 'usd',
        currentPrice,
        lowerPrice: currentLowerPrice,
        upperPrice: currentUpperPrice,
        token0Decimals,
        token1Decimals
      });

      currentLiquidity = rebalanceEntry.liquidity;
      currentToken0Amount = rebalanceEntry.token0Amount;
      currentToken1Amount = rebalanceEntry.token1Amount;

      rebalanceCount++;
      lastRebalanceTime = dataPoint.timestamp;
      lastRebalancePrice = currentPrice;
    }

    // Update price window for volatility calculation
    priceWindow.push(currentPrice);
    if (priceWindow.length > 30) {
      priceWindow.shift();
    }
  }

  // Calculate final results
  const finalDataPoint = priceHistory[priceHistory.length - 1];
  const finalPrice = finalDataPoint.price;
  const finalLPValue = currentToken0Amount * finalPrice + currentToken1Amount + totalFees;
  const finalHODLValue = calculateHODLValue(
    entry.token0Amount,
    entry.token1Amount,
    entryPrice,
    finalPrice,
    depositToken
  );

  const totalReturn = (finalLPValue - entry.valueUSD) / entry.valueUSD;
  const hodlReturn = (finalHODLValue - entry.valueUSD) / entry.valueUSD;
  const excessReturn = totalReturn - hodlReturn;

  // Calculate realized IL
  const realizedIL = finalHODLValue - (finalLPValue - totalFees + gasCosts);

  // Calculate time in range
  const totalPeriods = inRangePeriods + outOfRangePeriods;
  const timeInRange = totalPeriods > 0 ? inRangePeriods / totalPeriods : 0;

  // Find best and worst windows
  const { bestWindow, worstWindow } = findBestWorstWindows(equityCurve, entry.valueUSD);

  return {
    totalReturn,
    hodlReturn,
    excessReturn,
    totalFees,
    realizedIL,
    gasCosts,
    rebalanceCount,
    timeInRange,
    periodsOutOfRange: outOfRangePeriods,
    equityCurve,
    drawdowns,
    bestWindow,
    worstWindow
  };
}

// =============================================================================
// REBALANCE CHECKING
// =============================================================================

/**
 * Parameters for rebalance check
 */
interface RebalanceCheckParams {
  currentTime: number;
  lastRebalanceTime: number;
  currentPrice: number;
  lastRebalancePrice: number;
  currentLowerPrice: number;
  currentUpperPrice: number;
  priceWindow: number[];
  rebalanceParams?: BacktestParams['rebalanceParams'];
}

/**
 * Checks if a rebalance should be triggered
 * 
 * @param mode - Rebalance mode
 * @param params - Check parameters
 * @returns True if rebalance should occur
 */
function checkRebalance(
  mode: BacktestParams['rebalanceMode'],
  params: RebalanceCheckParams
): boolean {
  const {
    currentTime,
    lastRebalanceTime,
    currentPrice,
    lastRebalancePrice,
    currentLowerPrice,
    currentUpperPrice,
    priceWindow,
    rebalanceParams
  } = params;

  switch (mode) {
    case 'none':
      return false;

    case 'periodic':
      if (!rebalanceParams?.periodDays) return false;
      const daysSinceRebalance = (currentTime - lastRebalanceTime) / (24 * 60 * 60);
      return daysSinceRebalance >= rebalanceParams.periodDays;

    case 'threshold':
      if (!rebalanceParams?.priceThreshold) return false;
      const priceChange = Math.abs(currentPrice - lastRebalancePrice) / lastRebalancePrice;
      return priceChange >= rebalanceParams.priceThreshold;

    case 'volatility':
      if (!rebalanceParams?.volatilityThreshold || priceWindow.length < 7) return false;
      const volatility = calculateRollingVolatility(priceWindow);
      return volatility >= rebalanceParams.volatilityThreshold;

    default:
      return false;
  }
}

/**
 * Calculates rolling volatility from price window
 * 
 * @param prices - Array of prices
 * @returns Annualized volatility
 */
function calculateRollingVolatility(prices: number[]): number {
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

  // Annualize
  return dailyVol * Math.sqrt(365);
}

// =============================================================================
// WINDOW ANALYSIS
// =============================================================================

/**
 * Finds the best and worst performing windows
 * 
 * @param equityCurve - Equity curve data
 * @param initialValue - Initial investment value
 * @returns Best and worst windows
 */
function findBestWorstWindows(
  equityCurve: BacktestResult['equityCurve'],
  initialValue: number
): {
  bestWindow: BacktestResult['bestWindow'];
  worstWindow: BacktestResult['worstWindow'];
} {
  if (equityCurve.length < 2) {
    return {
      bestWindow: { start: 0, end: 0, return: 0 },
      worstWindow: { start: 0, end: 0, return: 0 }
    };
  }

  let bestReturn = -Infinity;
  let worstReturn = Infinity;
  let bestStart = equityCurve[0].timestamp;
  let bestEnd = equityCurve[0].timestamp;
  let worstStart = equityCurve[0].timestamp;
  let worstEnd = equityCurve[0].timestamp;

  // Use 7-day windows
  const windowDays = 7;

  for (let i = 0; i < equityCurve.length - windowDays; i++) {
    const startValue = equityCurve[i].lpValue;
    const endValue = equityCurve[i + windowDays].lpValue;
    const windowReturn = (endValue - startValue) / startValue;

    if (windowReturn > bestReturn) {
      bestReturn = windowReturn;
      bestStart = equityCurve[i].timestamp;
      bestEnd = equityCurve[i + windowDays].timestamp;
    }

    if (windowReturn < worstReturn) {
      worstReturn = windowReturn;
      worstStart = equityCurve[i].timestamp;
      worstEnd = equityCurve[i + windowDays].timestamp;
    }
  }

  return {
    bestWindow: {
      start: bestStart,
      end: bestEnd,
      return: bestReturn
    },
    worstWindow: {
      start: worstStart,
      end: worstEnd,
      return: worstReturn
    }
  };
}

// =============================================================================
// BACKTEST UTILITIES
// =============================================================================

/**
 * Calculates maximum drawdown from equity curve
 * 
 * @param equityCurve - Equity curve data
 * @returns Maximum drawdown (as decimal, e.g., 0.2 for 20%)
 */
export function calculateMaxDrawdown(
  equityCurve: Array<{ lpValue: number }>
): number {
  if (equityCurve.length === 0) return 0;

  let maxDrawdown = 0;
  let peak = equityCurve[0].lpValue;

  for (const point of equityCurve) {
    if (point.lpValue > peak) {
      peak = point.lpValue;
    }
    const drawdown = (peak - point.lpValue) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Calculates Sharpe ratio from equity curve
 * 
 * @param equityCurve - Equity curve data
 * @param riskFreeRate - Annual risk-free rate (default 0)
 * @returns Sharpe ratio
 */
export function calculateSharpeRatio(
  equityCurve: Array<{ lpValue: number; timestamp: number }>,
  riskFreeRate: number = 0
): number {
  if (equityCurve.length < 2) return 0;

  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const dailyReturn = (equityCurve[i].lpValue - equityCurve[i - 1].lpValue) / equityCurve[i - 1].lpValue;
    returns.push(dailyReturn);
  }

  // Calculate mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize
  const annualReturn = meanReturn * 365;
  const annualStdDev = stdDev * Math.sqrt(365);

  // Sharpe ratio
  return annualStdDev > 0 ? (annualReturn - riskFreeRate) / annualStdDev : 0;
}

/**
 * Compares multiple backtest strategies
 * 
 * @param baseParams - Base backtest parameters
 * @param strategies - Array of strategy variations
 * @returns Comparison results
 */
export function compareBacktestStrategies(
  baseParams: Omit<BacktestParams, 'lowerPrice' | 'upperPrice' | 'rebalanceMode'>,
  strategies: Array<{
    name: string;
    lowerPrice: number;
    upperPrice: number;
    rebalanceMode: BacktestParams['rebalanceMode'];
    rebalanceParams?: BacktestParams['rebalanceParams'];
  }>
): Array<{
  name: string;
  result: BacktestResult;
  maxDrawdown: number;
  sharpeRatio: number;
}> {
  return strategies.map(strategy => {
    const params: BacktestParams = {
      ...baseParams,
      lowerPrice: strategy.lowerPrice,
      upperPrice: strategy.upperPrice,
      rebalanceMode: strategy.rebalanceMode,
      rebalanceParams: strategy.rebalanceParams
    };

    const result = runBacktest(params);
    const maxDrawdown = calculateMaxDrawdown(result.equityCurve);
    const sharpeRatio = calculateSharpeRatio(result.equityCurve);

    return {
      name: strategy.name,
      result,
      maxDrawdown,
      sharpeRatio
    };
  });
}

/**
 * Generates a summary report for a backtest
 * 
 * @param result - Backtest result
 * @returns Formatted summary
 */
export function generateBacktestSummary(result: BacktestResult): string {
  const formatPercent = (n: number) => `${(n * 100).toFixed(2)}%`;
  const formatUSD = (n: number) => `$${n.toFixed(2)}`;

  return `
Backtest Summary
================
Total Return: ${formatPercent(result.totalReturn)}
HODL Return: ${formatPercent(result.hodlReturn)}
Excess Return: ${formatPercent(result.excessReturn)}

Fee Income: ${formatUSD(result.totalFees)}
Gas Costs: ${formatUSD(result.gasCosts)}
Realized IL: ${formatUSD(result.realizedIL)}

Rebalances: ${result.rebalanceCount}
Time In Range: ${formatPercent(result.timeInRange)}

Max Drawdown: ${formatPercent(calculateMaxDrawdown(result.equityCurve))}
Sharpe Ratio: ${calculateSharpeRatio(result.equityCurve).toFixed(2)}

Best 7D Window: ${formatPercent(result.bestWindow.return)}
Worst 7D Window: ${formatPercent(result.worstWindow.return)}
`;
}
