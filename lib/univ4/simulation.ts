/**
 * Uniswap V4 Hook-Aware Simulation Engine
 * 
 * Extends the V3 simulation engine with hook-specific behavior modeling.
 * This is the core module for estimating LP outcomes in V4 pools with hooks.
 */

import { ScenarioPoint } from '@/types';
import { 
  calculateEffectiveFeeRate, 
  estimateFlowCapture,
  calculateV4OptimalRange,
} from './math';
import { HOOK_REGISTRY, calculateHookLPScore, recommendHooks } from './hooks';

export { recommendHooks };

// ============================================================================
// Types
// ============================================================================

export interface V4SimulationParams {
  entryPrice: number;
  lowerPrice: number;
  upperPrice: number;
  depositAmount: number;
  depositToken: 'token0' | 'token1' | 'usd';
  baseFeeTier: number;
  volume24h: number;
  poolLiquidity: bigint;
  yourLiquidity: bigint;
  horizonDays: number;
  gasCostGwei: number;
  
  // Hook parameters
  hookId?: string;
  hookAddress?: string;
  isStaking?: boolean;
  
  // Market params
  volatility: number;
  estimatedDailySwaps: number;
}

export interface V4ScenarioPoint extends ScenarioPoint {
  hookShareUSD: number;
  gasOverheadUSD: number;
  effectiveFeeRate: number;
  flowCapture: number;
}

export interface V4SimulationResult {
  scenarios: V4ScenarioPoint[];
  baseCase: V4ScenarioPoint | null;
  bestCase: V4ScenarioPoint | null;
  worstCase: V4ScenarioPoint | null;
  hookAnalysis: {
    hookId?: string;
    hookName?: string;
    baseAPR: number;
    hookAdjustedAPR: number;
    riskScore: number;
    complexityScore: number;
    recommendation: string;
  };
  rangeAnalysis: {
    lowerPrice: number;
    upperPrice: number;
    tickWidth: number;
    estimatedTimeInRange: number;
  };
}

// ============================================================================
// Core Simulation
// ============================================================================

/**
 * Run a V4 hook-aware scenario simulation.
 * Generates a grid of exit prices and calculates LP outcomes
 * considering hook fee adjustments, flow multipliers, and gas overhead.
 */
export function simulateV4LP(params: V4SimulationParams): V4SimulationResult {
  const { 
    entryPrice, lowerPrice, upperPrice, 
    depositAmount, baseFeeTier, volume24h,
    poolLiquidity, yourLiquidity, horizonDays,
    hookId, isStaking, volatility, estimatedDailySwaps
  } = params;

  // Hook configuration
  const hook = hookId ? HOOK_REGISTRY[hookId] : undefined;
  const hookBehavior = hook?.behaviors;

  // Calculate effective fee rate
  const effectiveFeeRate = calculateEffectiveFeeRate(
    baseFeeTier,
    hookBehavior?.feeAdjustment || 'none',
    hookBehavior?.additionalFeeBips || hookBehavior?.hookShareBips || hookBehavior?.baseFeeBips || 0
  );

  // Flow multiplier
  const flowMultiplier = hookBehavior?.flowMultiplier ?? 1.0;

  // Gas overhead
  const gasOverheadPerSwap = hookBehavior?.gasOverheadPerSwap ?? 0;
  const totalGasOverheadUSD = (gasOverheadPerSwap * estimatedDailySwaps * horizonDays * 20) / 1e9;
    // Rough: gwei * gas * eth_price (~$2000) approximation simplified

  // Generate price scenarios (logarithmic from 0.1x to 4.0x)
  const scenarios: V4ScenarioPoint[] = [];
  const steps = 50;
  const minMultiplier = 0.1;
  const maxMultiplier = 4.0;
  
  for (let i = 0; i <= steps; i++) {
    const logMin = Math.log(minMultiplier);
    const logMax = Math.log(maxMultiplier);
    const logPrice = logMin + (logMax - logMin) * (i / steps);
    const priceMultiplier = Math.exp(logPrice);
    const exitPrice = entryPrice * priceMultiplier;

    // Determine if in range
    const inRange = exitPrice >= lowerPrice && exitPrice <= upperPrice;
    const belowRange = exitPrice < lowerPrice;
    const aboveRange = exitPrice > upperPrice;

    // Calculate position value at exit price
    const { token0Amount, token1Amount, lpValue } = calculatePositionAtPrice(
      entryPrice, exitPrice, lowerPrice, upperPrice, depositAmount, params.depositToken
    );

    // HODL benchmark
    const hodlValue = calculateHODLValue(entryPrice, exitPrice, depositAmount, params.depositToken);

    // Fee estimation
    const timeInRange = inRange ? estimateTimeInRange(lowerPrice, upperPrice, exitPrice, volatility) : 0;
    const flowCapture = estimateFlowCapture(volume24h, Number(yourLiquidity) / Number(poolLiquidity || 1n), timeInRange, flowMultiplier);
    const grossFees = flowCapture * effectiveFeeRate * horizonDays;
    
    // Hook share
    let hookShareUSD = 0;
    if (hookBehavior?.feeAdjustment === 'share' && hookBehavior.hookShareBips) {
      const baseFeeFlow = estimateFlowCapture(volume24h, Number(yourLiquidity) / Number(poolLiquidity || 1n), timeInRange, 1.0);
      hookShareUSD = baseFeeFlow * (baseFeeTier / 1_000_000) * (hookBehavior.hookShareBips / 10_000) * horizonDays;
    }

    const netFees = grossFees - hookShareUSD - totalGasOverheadUSD;
    const netReturn = lpValue + netFees - depositAmount;
    const divergenceLoss = hodlValue - lpValue;
    const excessReturnVsHODL = netReturn - (hodlValue - depositAmount);

    scenarios.push({
      exitPrice,
      priceChangePercent: (priceMultiplier - 1) * 100,
      lpValue,
      hodlValue,
      feesEarned: netFees,
      gasCosts: totalGasOverheadUSD,
      netReturn,
      excessReturnVsHODL,
      divergenceLoss,
      token0Amount,
      token1Amount,
      inRange,
      hookShareUSD,
      gasOverheadUSD: totalGasOverheadUSD,
      effectiveFeeRate,
      flowCapture,
    });
  }

  // Find base, best, worst cases
  const baseCase = scenarios.find(s => Math.abs(s.priceChangePercent) < 1) || scenarios[Math.floor(steps / 2)];
  const bestCase = scenarios.reduce((best, s) => s.netReturn > best.netReturn ? s : best, scenarios[0]);
  const worstCase = scenarios.reduce((worst, s) => s.netReturn < worst.netReturn ? s : worst, scenarios[0]);

  // Hook analysis
  const baseAPR = (baseCase.feesEarned / depositAmount) * (365 / horizonDays);
  let hookAnalysis: V4SimulationResult['hookAnalysis'];

  if (hookId) {
    const score = calculateHookLPScore({
      baseAPR,
      hookId,
      pairVolatility: volatility,
      estimatedDailySwaps,
      isStaking: isStaking ?? false,
    });
    hookAnalysis = {
      hookId,
      hookName: hook?.name,
      baseAPR,
      hookAdjustedAPR: score.netAPR,
      riskScore: score.riskScore,
      complexityScore: score.complexityScore,
      recommendation: score.recommendation,
    };
  } else {
    hookAnalysis = {
      baseAPR,
      hookAdjustedAPR: baseAPR,
      riskScore: 30,
      complexityScore: 10,
      recommendation: 'No hook selected. Standard V4 pool behavior.',
    };
  }

  // Time in range estimate for the chosen range
  const timeInRange = estimateTimeInRange(lowerPrice, upperPrice, entryPrice, volatility);

  return {
    scenarios,
    baseCase: baseCase || null,
    bestCase: bestCase || null,
    worstCase: worstCase || null,
    hookAnalysis,
    rangeAnalysis: {
      lowerPrice,
      upperPrice,
      tickWidth: Math.ceil((Math.log(upperPrice) - Math.log(lowerPrice)) / Math.log(1.0001)),
      estimatedTimeInRange: timeInRange,
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function calculatePositionAtPrice(
  entryPrice: number,
  exitPrice: number,
  lowerPrice: number,
  upperPrice: number,
  depositAmount: number,
  depositToken: 'token0' | 'token1' | 'usd'
): { token0Amount: number; token1Amount: number; lpValue: number } {
  // Simplified concentrated liquidity value calculation
  // For a balanced USD deposit at entryPrice
  
  let valueAtEntry: number;
  if (depositToken === 'usd') {
    valueAtEntry = depositAmount;
  } else if (depositToken === 'token0') {
    valueAtEntry = depositAmount * entryPrice;
  } else {
    valueAtEntry = depositAmount;
  }

  // If below range, all token0
  if (exitPrice <= lowerPrice) {
    const token0Value = valueAtEntry / Math.sqrt(entryPrice);
    const token0Amount = token0Value / Math.sqrt(lowerPrice);
    const currentValue = token0Amount * exitPrice;
    return { token0Amount, token1Amount: 0, lpValue: currentValue };
  }

  // If above range, all token1
  if (exitPrice >= upperPrice) {
    const token1Value = valueAtEntry * Math.sqrt(entryPrice);
    const token1Amount = token1Value / Math.sqrt(upperPrice);
    return { token0Amount: 0, token1Amount, lpValue: token1Amount };
  }

  // In range - use V3 concentrated liquidity formula (simplified)
  const sqrtP = Math.sqrt(exitPrice);
  const sqrtPL = Math.sqrt(lowerPrice);
  const sqrtPU = Math.sqrt(upperPrice);
  const sqrtPE = Math.sqrt(entryPrice);

  // Liquidity L (constant for the position)
  const L = valueAtEntry / (sqrtPE - sqrtPL + (1 / sqrtPE - 1 / sqrtPU) * entryPrice);

  const token0Amount = L * (sqrtPU - sqrtP) / (sqrtP * sqrtPU);
  const token1Amount = L * (sqrtP - sqrtPL);
  const lpValue = token0Amount * exitPrice + token1Amount;

  return { token0Amount, token1Amount, lpValue };
}

function calculateHODLValue(
  entryPrice: number,
  exitPrice: number,
  depositAmount: number,
  depositToken: 'token0' | 'token1' | 'usd'
): number {
  if (depositToken === 'usd') {
    // 50/50 split at entry
    const token0Amount = (depositAmount / 2) / entryPrice;
    const token1Amount = depositAmount / 2;
    return token0Amount * exitPrice + token1Amount;
  } else if (depositToken === 'token0') {
    return depositAmount * exitPrice;
  } else {
    return depositAmount;
  }
}

function estimateTimeInRange(
  lowerPrice: number,
  upperPrice: number,
  currentPrice: number,
  volatility: number
): number {
  // Simplified log-normal probability of staying in range
  // Uses the fact that for GBM, log(price) is normally distributed
  if (volatility === 0) return 1;

  const logLower = Math.log(lowerPrice / currentPrice);
  const logUpper = Math.log(upperPrice / currentPrice);
  const sigma = volatility;

  // Standard normal CDF approximation
  const cdf = (x: number) => {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * absX);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1 + sign * y);
  };

  // Probability price is currently in range (it is by definition if we check at entry)
  // For "time in range" over a period, we use a simplified estimate
  const rangeWidth = Math.log(upperPrice / lowerPrice);
  const probInRange = 1 - 2 * cdf(-rangeWidth / (2 * sigma));
  return Math.max(0, Math.min(1, probInRange));
}

// ============================================================================
// Range Optimization with Hooks
// ============================================================================

/**
 * Find optimal range width considering hook-specific behavior.
 * Some hooks reward tighter ranges (concentrated rewards),
 * others are neutral.
 */
export function optimizeV4Range(params: {
  currentPrice: number;
  volatility: number;
  hookId?: string;
  targetTimeInRange?: number;
}): {
  lowerPrice: number;
  upperPrice: number;
  tickWidth: number;
  estimatedTimeInRange: number;
  hookBonusFactor: number;
} {
  const { currentPrice, volatility, hookId, targetTimeInRange = 0.7 } = params;
  
  const hook = hookId ? HOOK_REGISTRY[hookId] : undefined;
  
  // Hook bonus factor: concentrated rewards encourage tighter ranges
  let hookBonusFactor = 1.0;
  if (hook?.name === 'Concentrated Rewards') {
    hookBonusFactor = 1.3; // 30% more effective for tight ranges
  }

  // Adjust target time in range based on hook
  const adjustedTarget = targetTimeInRange / hookBonusFactor;

  // Binary search for range width
  let low = 1;
  let high = 100000;
  let bestWidth = 6000; // default ~60 ticks at 0.3%

  for (let iter = 0; iter < 30; iter++) {
    const mid = Math.floor((low + high) / 2);
    const halfWidth = mid / 2;
    const lowerTick = -halfWidth;
    const upperTick = halfWidth;
    const lowerPrice = currentPrice * Math.pow(1.0001, lowerTick);
    const upperPrice = currentPrice * Math.pow(1.0001, upperTick);
    
    const timeInRange = estimateTimeInRange(lowerPrice, upperPrice, currentPrice, volatility);
    
    if (timeInRange < adjustedTarget) {
      low = mid;
    } else {
      high = mid;
      bestWidth = mid;
    }
  }

  const halfWidth = bestWidth / 2;
  const lowerPrice = currentPrice * Math.pow(1.0001, -halfWidth);
  const upperPrice = currentPrice * Math.pow(1.0001, halfWidth);

  return {
    lowerPrice,
    upperPrice,
    tickWidth: bestWidth,
    estimatedTimeInRange: estimateTimeInRange(lowerPrice, upperPrice, currentPrice, volatility),
    hookBonusFactor,
  };
}
