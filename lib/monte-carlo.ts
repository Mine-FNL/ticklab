/**
 * Monte Carlo Simulation Engine for UniV3 LP Strategies
 * 
 * Uses Geometric Brownian Motion with optional mean reversion
 * to simulate price paths and calculate LP return distributions.
 */

import { calculateIL } from './il'

export interface MonteCarloParams {
  // Entry conditions
  entryPrice: number
  lowerTick: number
  upperTick: number
  depositUSD: number
  feeTier: number        // bps (e.g., 3000 = 0.30%)
  liquidity: number       // pool TVL
  
  // Simulation settings
  simulations: number     // number of paths (1000-10000)
  days: number          // time horizon
  dailyVolume: number   // assumed daily volume
  
  // Volatility & drift
  volatilityDaily: number   // daily vol (e.g., 0.03 for 3%)
  driftDaily: number        // daily drift (e.g., 0.0002 for ~7% annual)
  
  // Optional: mean reversion
  meanReversionStrength?: number  // 0 = no reversion, 1 = full
  targetPrice?: number             // mean reversion target
}

export interface MonteCarloResult {
  // Summary stats
  medianReturn: number
  meanReturn: number
  stdDev: number
  sharpeRatio: number
  
  // Percentiles
  p10: number   // 10th percentile (bad)
  p25: number   // 25th percentile
  p50: number   // 50th percentile (median)
  p75: number   // 75th percentile
  p90: number   // 90th percentile (good)
  
  // Probabilities
  probProfit: number     // probability of profit
  probBeatingHODL: number
  
  // Breakdown by outcome
  lossPercent: number    // % of simulations that lost money
  breakEvenPercent: number
  
  // All simulation paths (for charting)
  paths: SimulationPath[]
}

export interface SimulationPath {
  pathId: number
  finalPrice: number
  priceMovePercent: number
  lpReturn: number
  hodlReturn: number
  feesEarned: number
  ilLoss: number
  netReturn: number
  inRangePercent: number
  peakReturn: number
  troughReturn: number
}

/**
 * Box-Muller transform for normal distribution
 * Generates standard normal random numbers for GBM
 */
function randomNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/**
 * Generate price path using geometric Brownian motion
 * with optional mean reversion (Ornstein-Uhlenbeck process)
 */
function generatePricePath(
  startPrice: number,
  days: number,
  volatility: number,
  drift: number,
  meanReversion: number,
  targetPrice: number
): number[] {
  const prices: number[] = [startPrice]
  
  for (let d = 1; d < days; d++) {
    const prev = prices[d - 1]
    const randomShock = randomNormal() * volatility * prev
    const driftComponent = drift * prev
    const reversionComponent = meanReversion * (targetPrice - prev)
    
    const newPrice = prev + driftComponent + randomShock + reversionComponent
    // Floor at 1% of start price to prevent pathological behavior
    prices.push(Math.max(newPrice, startPrice * 0.01))
  }
  
  return prices
}

/**
 * Check if price is within the LP's tick range
 */
function isInRange(price: number, entryPrice: number, lowerTick: number, upperTick: number): boolean {
  const tickMove = Math.log(price / entryPrice) / Math.log(1.0001)
  return tickMove >= lowerTick && tickMove <= upperTick
}

/**
 * Run Monte Carlo simulation for UniV3 LP strategy
 * 
 * @param params - Simulation parameters
 * @returns MonteCarloResult with statistics and paths
 */
export async function runMonteCarlo(params: MonteCarloParams): Promise<MonteCarloResult> {
  const paths: SimulationPath[] = []
  const returns: number[] = []
  const beatingHODL: number[] = []
  
  const { 
    entryPrice, lowerTick, upperTick, depositUSD, 
    feeTier, liquidity, simulations, days, dailyVolume,
    volatilityDaily, driftDaily, meanReversionStrength = 0, targetPrice = entryPrice 
  } = params
  
  // Fee per day per unit of liquidity (simplified model)
  const feeRatePerDay = (dailyVolume * feeTier / 10000) / liquidity
  
  for (let sim = 0; sim < simulations; sim++) {
    // Generate price path using GBM
    const prices = generatePricePath(
      entryPrice, days, volatilityDaily, driftDaily,
      meanReversionStrength, targetPrice
    )
    
    // Track path metrics
    let feesEarned = 0
    let inRangeDays = 0
    let peakReturn = -Infinity
    let troughReturn = Infinity
    let hodlReturn = 0
    
    for (let d = 0; d < prices.length; d++) {
      const price = prices[d]
      const inRange = isInRange(price, entryPrice, lowerTick, upperTick)
      
      if (inRange) {
        inRangeDays++
        // Accumulate fees proportionally to deposit
        feesEarned += depositUSD * feeRatePerDay
      }
      
      // Calculate IL and LP value at this timestep
      const il = calculateIL(entryPrice, price, feesEarned, 0)
      const lpValue = depositUSD + il.ilAbsolute + feesEarned
      const hodlValue = depositUSD * (price / entryPrice)
      
      const lpReturn = ((lpValue - depositUSD) / depositUSD) * 100
      peakReturn = Math.max(peakReturn, lpReturn)
      troughReturn = Math.min(troughReturn, lpReturn)
      hodlReturn = ((hodlValue - depositUSD) / depositUSD) * 100
    }
    
    // Final values at end of simulation
    const finalPrice = prices[prices.length - 1]
    const finalIL = calculateIL(entryPrice, finalPrice, feesEarned, 0)
    const lpReturn = ((finalIL.lpValue - depositUSD) / depositUSD) * 100
    const hodlReturnFinal = ((finalPrice - entryPrice) / entryPrice) * 100
    
    paths.push({
      pathId: sim,
      finalPrice,
      priceMovePercent: ((finalPrice - entryPrice) / entryPrice) * 100,
      lpReturn,
      hodlReturn: hodlReturnFinal,
      feesEarned,
      ilLoss: finalIL.ilAbsolute,
      netReturn: finalIL.excessReturn ?? lpReturn,
      inRangePercent: inRangeDays / days,
      peakReturn: peakReturn === -Infinity ? 0 : peakReturn,
      troughReturn: troughReturn === Infinity ? 0 : troughReturn,
    })
    
    returns.push(lpReturn)
    
    // Track if LP beat HODL in this path
    if (hodlReturnFinal > 0) {
      beatingHODL.push(lpReturn > 0 ? 1 : 0)
    } else {
      // If HODL lost money, check if LP lost less
      beatingHODL.push(lpReturn >= hodlReturnFinal ? 1 : 0)
    }
  }
  
  // Sort returns for percentile calculations
  returns.sort((a, b) => a - b)
  
  // Calculate summary statistics
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
  const stdDev = Math.sqrt(variance)
  
  // Sort paths by return for percentile extraction
  const sortedByReturn = [...paths].sort((a, b) => a.netReturn - b.netReturn)
  
  const getPercentile = (p: number) => {
    const index = Math.floor(simulations * p / 100)
    return sortedByReturn[index]?.netReturn ?? 0
  }
  
  return {
    medianReturn: getPercentile(50),
    meanReturn: mean,
    stdDev,
    sharpeRatio: stdDev > 0 ? (mean - 0) / stdDev : 0, // risk-free rate = 0
    p10: getPercentile(10),
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90),
    probProfit: returns.filter(r => r > 0).length / simulations,
    probBeatingHODL: beatingHODL.reduce((a, b) => a + b, 0) / simulations,
    lossPercent: returns.filter(r => r < 0).length / simulations * 100,
    breakEvenPercent: returns.filter(r => r === 0).length / simulations * 100,
    paths: paths.slice(0, 100), // Return max 100 paths for charting
  }
}
