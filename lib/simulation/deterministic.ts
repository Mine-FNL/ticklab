/**
 * Deterministic Scenario Simulation for Uniswap V3
 * 
 * This module provides deterministic scenario analysis for Uniswap V3 LP positions.
 * It generates a grid of price scenarios and calculates key metrics for each:
 * - LP position value
 * - HODL benchmark value
 * - Fees earned
 * - Net return vs HODL
 * - Impermanent loss
 * 
 * @module simulation/deterministic
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
  priceToTick
} from '../univ3/math';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parameters for deterministic scenario analysis
 */
export interface DeterministicScenarioParams {
  /** Entry price (token1 per token0) */
  entryPrice: number;
  
  /** Token0 decimals */
  token0Decimals: number;
  
  /** Token1 decimals */
  token1Decimals: number;
  
  /** Lower price bound of position */
  lowerPrice: number;
  
  /** Upper price bound of position */
  upperPrice: number;
  
  /** Deposit amount */
  depositAmount: number;
  
  /** Deposit token type */
  depositToken: 'token0' | 'token1' | 'usd';
  
  /** Daily volume in USD */
  dailyVolumeUSD: number;
  
  /** Fee tier in basis points (100, 500, 3000, 10000) */
  feeTier: number;
  
  /** Position liquidity / active liquidity ratio */
  liquidityShare: number;
  
  /** Investment horizon in days */
  horizonDays: number;
  
  /** Gas cost in gwei */
  gasCostGwei: number;
  
  /** Number of rebalances expected */
  rebalanceCount: number;
}

/**
 * Single scenario point result
 */
export interface ScenarioPoint {
  /** Exit price for this scenario */
  exitPrice: number;
  
  /** Price change from entry as percentage */
  priceChangePercent: number;
  
  /** LP position value in USD */
  lpValue: number;
  
  /** HODL benchmark value in USD */
  hodlValue: number;
  
  /** Fees earned in USD */
  feesEarned: number;
  
  /** Gas costs in USD */
  gasCosts: number;
  
  /** Net return (LP value + fees - gas - initial deposit) */
  netReturn: number;
  
  /** Excess return vs HODL */
  excessReturnVsHODL: number;
  
  /** Divergence loss (negative = loss) */
  divergenceLoss: number;
  
  /** Token0 amount in position */
  token0Amount: number;
  
  /** Token1 amount in position */
  token1Amount: number;
  
  /** Whether position is in range */
  inRange: boolean;
}

// =============================================================================
// MAIN SCENARIO FUNCTION
// =============================================================================

/**
 * Runs a deterministic scenario analysis across a price range
 * 
 * This function generates a grid of exit prices and calculates
 * comprehensive metrics for each price point.
 * 
 * @param params - Scenario parameters
 * @param priceRange - Price range for the grid
 * @returns Array of scenario points
 * 
 * @example
 * ```typescript
 * const scenarios = runDeterministicScenario(
 *   {
 *     entryPrice: 2000,
 *     token0Decimals: 18,
 *     token1Decimals: 6,
 *     lowerPrice: 1800,
 *     upperPrice: 2400,
 *     depositAmount: 10000,
 *     depositToken: 'usd',
 *     dailyVolumeUSD: 1000000,
 *     feeTier: 500,
 *     liquidityShare: 0.02,
 *     horizonDays: 30,
 *     gasCostGwei: 20,
 *     rebalanceCount: 0
 *   },
 *   { min: 1500, max: 3000, steps: 50 }
 * );
 * ```
 */
export function runDeterministicScenario(
  params: DeterministicScenarioParams,
  priceRange: { min: number; max: number; steps: number }
): ScenarioPoint[] {
  const {
    entryPrice,
    token0Decimals,
    token1Decimals,
    lowerPrice,
    upperPrice,
    depositAmount,
    depositToken,
    dailyVolumeUSD,
    feeTier,
    liquidityShare,
    horizonDays,
    gasCostGwei,
    rebalanceCount
  } = params;

  const { min, max, steps } = priceRange;
  const results: ScenarioPoint[] = [];

  // Calculate entry position
  const entry = calculatePositionEntry({
    depositAmount,
    depositToken,
    currentPrice: entryPrice,
    lowerPrice,
    upperPrice,
    token0Decimals,
    token1Decimals
  });

  // Calculate gas costs
  const ethPriceUSD = 3000; // Assumed ETH price for gas calculation
  const gasUnitsPerRebalance = 250000; // Approximate gas for rebalance
  const gasCostPerRebalanceETH = (gasCostGwei * gasUnitsPerRebalance) / 1e9;
  const totalGasCostsUSD = gasCostPerRebalanceETH * ethPriceUSD * rebalanceCount;

  // Use logarithmic spacing for better coverage
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const logStep = (logMax - logMin) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const exitPrice = Math.exp(logMin + i * logStep);
    const priceChangePercent = (exitPrice - entryPrice) / entryPrice;

    // Calculate IL for this exit price
    const il = calculateIL({
      entryPrice,
      exitPrice,
      lowerPrice,
      upperPrice,
      depositAmount,
      depositToken,
      token0Decimals,
      token1Decimals
    });

    // Calculate fees
    const timeInRange = il.inRange ? 1.0 : 0.0;
    const feeEstimate = estimateFees({
      currentLiquidity: BigInt(Math.floor(entry.liquidity / liquidityShare)),
      activeLiquidityInRange: entry.liquidity,
      feeTier,
      dailyVolumeUSD,
      volumeScenario: 'base',
      positionLiquidity: entry.liquidity,
      timeInRange,
      horizonDays
    });

    // Calculate net metrics
    const netReturn = il.lpValue + feeEstimate.base - totalGasCostsUSD - entry.valueUSD;
    const excessReturnVsHODL = netReturn - (il.hodlValue - entry.valueUSD);

    results.push({
      exitPrice,
      priceChangePercent,
      lpValue: il.lpValue,
      hodlValue: il.hodlValue,
      feesEarned: feeEstimate.base,
      gasCosts: totalGasCostsUSD,
      netReturn,
      excessReturnVsHODL,
      divergenceLoss: il.divergenceLoss,
      token0Amount: il.token0Amount,
      token1Amount: il.token1Amount,
      inRange: il.inRange
    });
  }

  return results;
}

// =============================================================================
// SCENARIO ANALYSIS HELPERS
// =============================================================================

/**
 * Finds the break-even price for a position
 * 
 * @param scenarios - Array of scenario points
 * @returns Break-even price (where netReturn = 0)
 */
export function findBreakEvenPrice(scenarios: ScenarioPoint[]): number | null {
  for (let i = 0; i < scenarios.length - 1; i++) {
    const current = scenarios[i];
    const next = scenarios[i + 1];
    
    // Check if break-even is between these two points
    if ((current.netReturn <= 0 && next.netReturn >= 0) ||
        (current.netReturn >= 0 && next.netReturn <= 0)) {
      // Linear interpolation
      const t = Math.abs(current.netReturn) / (Math.abs(current.netReturn) + Math.abs(next.netReturn));
      return current.exitPrice + t * (next.exitPrice - current.exitPrice);
    }
  }
  return null;
}

/**
 * Finds the maximum profit scenario
 * 
 * @param scenarios - Array of scenario points
 * @returns Scenario point with maximum net return
 */
export function findMaxProfitScenario(scenarios: ScenarioPoint[]): ScenarioPoint | null {
  if (scenarios.length === 0) return null;
  
  return scenarios.reduce((max, current) => 
    current.netReturn > max.netReturn ? current : max
  );
}

/**
 * Finds the maximum loss scenario
 * 
 * @param scenarios - Array of scenario points
 * @returns Scenario point with minimum net return
 */
export function findMaxLossScenario(scenarios: ScenarioPoint[]): ScenarioPoint | null {
  if (scenarios.length === 0) return null;
  
  return scenarios.reduce((min, current) => 
    current.netReturn < min.netReturn ? current : min
  );
}

/**
 * Calculates scenario statistics
 * 
 * @param scenarios - Array of scenario points
 * @returns Statistical summary
 */
export function calculateScenarioStats(scenarios: ScenarioPoint[]): {
  meanReturn: number;
  medianReturn: number;
  maxReturn: number;
  minReturn: number;
  stdDev: number;
  sharpeRatio: number;
  percentiles: Record<number, number>;
} {
  if (scenarios.length === 0) {
    return {
      meanReturn: 0,
      medianReturn: 0,
      maxReturn: 0,
      minReturn: 0,
      stdDev: 0,
      sharpeRatio: 0,
      percentiles: {}
    };
  }

  const returns = scenarios.map(s => s.netReturn);
  
  // Mean
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  
  // Median
  const sorted = [...returns].sort((a, b) => a - b);
  const medianReturn = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  // Max/Min
  const maxReturn = Math.max(...returns);
  const minReturn = Math.min(...returns);
  
  // Standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Sharpe ratio (assuming 0 risk-free rate for simplicity)
  const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;
  
  // Percentiles
  const percentiles: Record<number, number> = {};
  [5, 10, 25, 50, 75, 90, 95].forEach(p => {
    const index = Math.floor((p / 100) * (sorted.length - 1));
    percentiles[p] = sorted[index];
  });

  return {
    meanReturn,
    medianReturn,
    maxReturn,
    minReturn,
    stdDev,
    sharpeRatio,
    percentiles
  };
}

// =============================================================================
// SCENARIO COMPARISON
// =============================================================================

/**
 * Compares multiple position strategies
 * 
 * @param baseParams - Base scenario parameters
 * @param strategies - Array of strategy variations
 * @param priceRange - Price range for comparison
 * @returns Comparison results
 */
export function compareStrategies(
  baseParams: Omit<DeterministicScenarioParams, 'lowerPrice' | 'upperPrice'>,
  strategies: Array<{
    name: string;
    lowerPrice: number;
    upperPrice: number;
  }>,
  priceRange: { min: number; max: number; steps: number }
): Array<{
  name: string;
  scenarios: ScenarioPoint[];
  stats: ReturnType<typeof calculateScenarioStats>;
  breakEvenPrice: number | null;
  maxProfit: ScenarioPoint | null;
  maxLoss: ScenarioPoint | null;
}> {
  return strategies.map(strategy => {
    const params: DeterministicScenarioParams = {
      ...baseParams,
      lowerPrice: strategy.lowerPrice,
      upperPrice: strategy.upperPrice
    };
    
    const scenarios = runDeterministicScenario(params, priceRange);
    
    return {
      name: strategy.name,
      scenarios,
      stats: calculateScenarioStats(scenarios),
      breakEvenPrice: findBreakEvenPrice(scenarios),
      maxProfit: findMaxProfitScenario(scenarios),
      maxLoss: findMaxLossScenario(scenarios)
    };
  });
}

// =============================================================================
// SCENARIO VISUALIZATION HELPERS
// =============================================================================

/**
 * Formats scenarios for chart visualization
 * 
 * @param scenarios - Array of scenario points
 * @returns Formatted data for charts
 */
export function formatScenariosForChart(scenarios: ScenarioPoint[]): {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
} {
  return {
    labels: scenarios.map(s => `${(s.priceChangePercent * 100).toFixed(1)}%`),
    datasets: [
      {
        label: 'LP Value',
        data: scenarios.map(s => s.lpValue)
      },
      {
        label: 'HODL Value',
        data: scenarios.map(s => s.hodlValue)
      },
      {
        label: 'Net Return',
        data: scenarios.map(s => s.netReturn)
      },
      {
        label: 'Fees Earned',
        data: scenarios.map(s => s.feesEarned)
      }
    ]
  };
}

/**
 * Generates a risk/reward summary for scenarios
 * 
 * @param scenarios - Array of scenario points
 * @returns Risk/reward summary
 */
export function generateRiskRewardSummary(scenarios: ScenarioPoint[]): {
  upsidePotential: number;
  downsideRisk: number;
  riskRewardRatio: number;
  probabilityOfProfit: number;
  expectedReturn: number;
} {
  const stats = calculateScenarioStats(scenarios);
  const initialDeposit = scenarios[0]?.lpValue ?? 0;
  
  // Upside potential (max profit)
  const upsidePotential = stats.maxReturn;
  
  // Downside risk (max loss)
  const downsideRisk = Math.abs(stats.minReturn);
  
  // Risk/reward ratio
  const riskRewardRatio = upsidePotential > 0 ? downsideRisk / upsidePotential : Infinity;
  
  // Probability of profit (scenarios with positive return)
  const profitableScenarios = scenarios.filter(s => s.netReturn > 0).length;
  const probabilityOfProfit = scenarios.length > 0 ? profitableScenarios / scenarios.length : 0;
  
  // Expected return
  const expectedReturn = stats.meanReturn;

  return {
    upsidePotential,
    downsideRisk,
    riskRewardRatio,
    probabilityOfProfit,
    expectedReturn
  };
}
