/**
 * Monte Carlo Simulation for Uniswap V3 Price Paths
 * 
 * This module provides stochastic price path generation using various models:
 * - Geometric Brownian Motion (GBM) - standard model
 * - Mean-reverting Ornstein-Uhlenbeck (OU) process
 * - Jump diffusion (Merton model)
 * 
 * These simulations are used to estimate the distribution of future
 * LP position outcomes under different market assumptions.
 * 
 * @module simulation/monte-carlo
 * @author UniV3 Strategy Lab
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parameters for Monte Carlo simulation
 */
export interface MonteCarloParams {
  /** Initial price */
  initialPrice: number;
  
  /** Annualized expected return (drift), e.g., 0.1 for 10% */
  drift: number;
  
  /** Annualized volatility, e.g., 0.8 for 80% */
  volatility: number;
  
  /** Time horizon in days */
  timeHorizon: number;
  
  /** Number of simulations to run */
  numSimulations: number;
  
  /** Optional mean reversion parameters */
  meanReversion?: {
    enabled: boolean;
    speed: number;        // Rate of mean reversion (kappa)
    longTermMean: number; // Long-term mean price
  };
  
  /** Optional jump diffusion parameters */
  jumpDiffusion?: {
    enabled: boolean;
    jumpIntensity: number;  // Expected jumps per year (lambda)
    jumpSizeMean: number;   // Mean of log jump size
    jumpSizeStd: number;    // Std dev of log jump size
  };
}

/**
 * Result of Monte Carlo simulation
 */
export interface MonteCarloResult {
  /** All price paths [simulation][time step] */
  paths: number[][];
  
  /** Final prices from each simulation */
  finalPrices: number[];
  
  /** Statistical summary of final prices */
  statistics: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    percentiles: Record<number, number>;
  };
}

// =============================================================================
// MAIN MONTE CARLO FUNCTION
// =============================================================================

/**
 * Runs a Monte Carlo simulation for price paths
 * 
 * This is the main function that generates multiple price paths
 * based on the specified stochastic model.
 * 
 * @param params - Monte Carlo parameters
 * @returns Simulation results with paths and statistics
 * 
 * @example
 * ```typescript
 * const result = runMonteCarloSimulation({
 *   initialPrice: 2000,
 *   drift: 0.1,        // 10% annual return
 *   volatility: 0.8,   // 80% annual volatility
 *   timeHorizon: 30,   // 30 days
 *   numSimulations: 1000,
 *   meanReversion: {
 *     enabled: true,
 *     speed: 5.0,
 *     longTermMean: 2000
 *   }
 * });
 * ```
 */
export function runMonteCarloSimulation(params: MonteCarloParams): MonteCarloResult {
  const {
    initialPrice,
    drift,
    volatility,
    timeHorizon,
    numSimulations,
    meanReversion,
    jumpDiffusion
  } = params;

  const paths: number[][] = [];
  const finalPrices: number[] = [];

  // Determine time steps (daily)
  const timeSteps = Math.ceil(timeHorizon);
  const dt = timeHorizon / 365 / timeSteps; // Time step in years

  for (let sim = 0; sim < numSimulations; sim++) {
    let path: number[];

    if (meanReversion?.enabled) {
      // Use mean-reverting OU process
      path = generateMeanRevertingPath(
        initialPrice,
        meanReversion.longTermMean,
        meanReversion.speed,
        volatility,
        timeHorizon,
        timeSteps
      );
    } else if (jumpDiffusion?.enabled) {
      // Use jump diffusion
      path = generateJumpDiffusionPath(
        initialPrice,
        drift,
        volatility,
        jumpDiffusion.jumpIntensity,
        jumpDiffusion.jumpSizeMean,
        jumpDiffusion.jumpSizeStd,
        timeHorizon,
        timeSteps
      );
    } else {
      // Standard GBM
      path = generateGBMPath(
        initialPrice,
        drift,
        volatility,
        timeHorizon,
        timeSteps
      );
    }

    paths.push(path);
    finalPrices.push(path[path.length - 1]);
  }

  // Calculate statistics
  const statistics = calculatePriceStatistics(finalPrices);

  return {
    paths,
    finalPrices,
    statistics
  };
}

// =============================================================================
// GEOMETRIC BROWNIAN MOTION
// =============================================================================

/**
 * Generates a single Geometric Brownian Motion price path
 * 
 * GBM formula: dS/S = μdt + σdW
 * Solution: S(t) = S(0) * exp((μ - σ²/2)t + σW(t))
 * 
 * @param initialPrice - Starting price
 * @param drift - Annualized drift (expected return)
 * @param volatility - Annualized volatility
 * @param timeHorizon - Time horizon in days
 * @param timeSteps - Number of time steps
 * @returns Price path array
 * 
 * @example
 * ```typescript
 * const path = generateGBMPath(2000, 0.1, 0.8, 30, 30);
 * // Returns 30 daily prices over 30 days
 * ```
 */
export function generateGBMPath(
  initialPrice: number,
  drift: number,
  volatility: number,
  timeHorizon: number,
  timeSteps: number
): number[] {
  const path: number[] = [initialPrice];
  const dt = timeHorizon / 365 / timeSteps; // Time step in years
  
  // Pre-calculate constants
  const driftTerm = (drift - 0.5 * volatility * volatility) * dt;
  const volTerm = volatility * Math.sqrt(dt);

  let currentPrice = initialPrice;

  for (let i = 1; i <= timeSteps; i++) {
    // Generate standard normal random variable (Box-Muller)
    const z = generateNormalRandom();
    
    // GBM update
    const priceChange = Math.exp(driftTerm + volTerm * z);
    currentPrice = currentPrice * priceChange;
    
    path.push(currentPrice);
  }

  return path;
}

// =============================================================================
// MEAN-REVERTING PROCESS (ORNSTEIN-UHLENBECK)
// =============================================================================

/**
 * Generates a mean-reverting price path using Ornstein-Uhlenbeck process
 * 
 * OU formula: dS = κ(θ - S)dt + σdW
 * where κ is speed of reversion, θ is long-term mean
 * 
 * @param initialPrice - Starting price
 * @param longTermMean - Long-term mean price (theta)
 * @param speed - Speed of mean reversion (kappa)
 * @param volatility - Annualized volatility
 * @param timeHorizon - Time horizon in days
 * @param timeSteps - Number of time steps
 * @returns Price path array
 * 
 * @example
 * ```typescript
 * const path = generateMeanRevertingPath(
 *   2000,   // Initial price
 *   2000,   // Long-term mean
 *   5.0,    // Speed of reversion
 *   0.8,    // Volatility
 *   30,     // 30 days
 *   30      // Daily steps
 * );
 * ```
 */
export function generateMeanRevertingPath(
  initialPrice: number,
  longTermMean: number,
  speed: number,
  volatility: number,
  timeHorizon: number,
  timeSteps: number
): number[] {
  const path: number[] = [initialPrice];
  const dt = timeHorizon / 365 / timeSteps;
  
  let currentPrice = initialPrice;

  for (let i = 1; i <= timeSteps; i++) {
    const z = generateNormalRandom();
    
    // OU process in log space for positive prices
    const logPrice = Math.log(currentPrice);
    const logMean = Math.log(longTermMean);
    
    // d(log S) = κ(θ - log S)dt + σdW
    const dLogPrice = speed * (logMean - logPrice) * dt + volatility * Math.sqrt(dt) * z;
    const newLogPrice = logPrice + dLogPrice;
    
    currentPrice = Math.exp(newLogPrice);
    path.push(currentPrice);
  }

  return path;
}

// =============================================================================
// JUMP DIFFUSION (MERTON MODEL)
// =============================================================================

/**
 * Generates a jump diffusion price path (Merton model)
 * 
 * Combines GBM with random jumps occurring at Poisson-distributed times.
 * 
 * @param initialPrice - Starting price
 * @param drift - Annualized drift
 * @param volatility - Annualized volatility
 * @param jumpIntensity - Expected jumps per year (lambda)
 * @param jumpSizeMean - Mean of log jump size
 * @param jumpSizeStd - Std dev of log jump size
 * @param timeHorizon - Time horizon in days
 * @param timeSteps - Number of time steps
 * @returns Price path array
 */
export function generateJumpDiffusionPath(
  initialPrice: number,
  drift: number,
  volatility: number,
  jumpIntensity: number,
  jumpSizeMean: number,
  jumpSizeStd: number,
  timeHorizon: number,
  timeSteps: number
): number[] {
  const path: number[] = [initialPrice];
  const dt = timeHorizon / 365 / timeSteps;
  
  // Adjust drift for jumps
  const adjustedDrift = drift - jumpIntensity * (Math.exp(jumpSizeMean + 0.5 * jumpSizeStd ** 2) - 1);
  
  const driftTerm = (adjustedDrift - 0.5 * volatility * volatility) * dt;
  const volTerm = volatility * Math.sqrt(dt);
  
  let currentPrice = initialPrice;

  for (let i = 1; i <= timeSteps; i++) {
    // Diffusion component
    const z = generateNormalRandom();
    let newPrice = currentPrice * Math.exp(driftTerm + volTerm * z);
    
    // Jump component
    const jumpProbability = 1 - Math.exp(-jumpIntensity * dt);
    if (Math.random() < jumpProbability) {
      const jumpSize = generateNormalRandom() * jumpSizeStd + jumpSizeMean;
      newPrice = newPrice * Math.exp(jumpSize);
    }
    
    currentPrice = newPrice;
    path.push(currentPrice);
  }

  return path;
}

// =============================================================================
// STATISTICAL UTILITIES
// =============================================================================

/**
 * Calculates statistics for a set of prices
 * 
 * @param prices - Array of prices
 * @returns Statistical summary
 */
function calculatePriceStatistics(prices: number[]): {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  percentiles: Record<number, number>;
} {
  if (prices.length === 0) {
    return {
      mean: 0,
      median: 0,
      std: 0,
      min: 0,
      max: 0,
      percentiles: {}
    };
  }

  // Mean
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  // Median
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  // Standard deviation
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const std = Math.sqrt(variance);
  
  // Min/Max
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  // Percentiles
  const percentiles: Record<number, number> = {};
  [1, 5, 10, 25, 50, 75, 90, 95, 99].forEach(p => {
    const index = Math.floor((p / 100) * (sorted.length - 1));
    percentiles[p] = sorted[index];
  });

  return {
    mean,
    median,
    std,
    min,
    max,
    percentiles
  };
}

/**
 * Generates a standard normal random variable using Box-Muller transform
 * 
 * @returns Standard normal random variable (mean=0, std=1)
 */
function generateNormalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// =============================================================================
// ADVANCED SIMULATION FEATURES
// =============================================================================

/**
 * Simulates LP position outcomes using Monte Carlo
 * 
 * @param params - Monte Carlo parameters
 * @param positionParams - Position parameters
 * @returns Distribution of position outcomes
 */
export function simulateLPOutcomes(
  params: MonteCarloParams,
  positionParams: {
    lowerPrice: number;
    upperPrice: number;
    depositAmount: number;
    feeAPR: number;
  }
): {
  finalValues: number[];
  returns: number[];
  statistics: {
    meanReturn: number;
    medianReturn: number;
    stdReturn: number;
    var95: number;
    cvar95: number;
  };
} {
  const mcResult = runMonteCarloSimulation(params);
  
  const finalValues: number[] = [];
  const returns: number[] = [];
  
  mcResult.finalPrices.forEach(finalPrice => {
    // Simplified position value calculation
    // In practice, use proper IL calculation
    const priceRatio = finalPrice / params.initialPrice;
    
    // Rough estimate: position value scales with sqrt of price
    const positionValue = positionParams.depositAmount * Math.sqrt(priceRatio);
    
    // Add fees
    const fees = positionParams.depositAmount * positionParams.feeAPR * (params.timeHorizon / 365);
    
    const finalValue = positionValue + fees;
    const totalReturn = (finalValue - positionParams.depositAmount) / positionParams.depositAmount;
    
    finalValues.push(finalValue);
    returns.push(totalReturn);
  });
  
  // Calculate return statistics
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const medianReturn = sortedReturns[Math.floor(sortedReturns.length / 2)];
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdReturn = Math.sqrt(variance);
  
  // VaR and CVaR at 95%
  const varIndex = Math.floor(0.05 * sortedReturns.length);
  const var95 = sortedReturns[varIndex];
  const cvar95 = sortedReturns.slice(0, varIndex).reduce((a, b) => a + b, 0) / varIndex;
  
  return {
    finalValues,
    returns,
    statistics: {
      meanReturn,
      medianReturn,
      stdReturn,
      var95,
      cvar95
    }
  };
}

/**
 * Calibrates model parameters from historical price data
 * 
 * @param priceHistory - Array of historical prices
 * @returns Calibrated parameters
 */
export function calibrateFromHistory(priceHistory: number[]): {
  drift: number;
  volatility: number;
  meanReversionSpeed?: number;
  longTermMean?: number;
} {
  if (priceHistory.length < 2) {
    return { drift: 0, volatility: 0 };
  }

  // Calculate log returns
  const logReturns: number[] = [];
  for (let i = 1; i < priceHistory.length; i++) {
    logReturns.push(Math.log(priceHistory[i] / priceHistory[i - 1]));
  }

  // Mean of log returns
  const meanLogReturn = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  
  // Volatility (annualized)
  const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - meanLogReturn, 2), 0) / logReturns.length;
  const dailyVol = Math.sqrt(variance);
  const annualVol = dailyVol * Math.sqrt(365);
  
  // Drift (annualized)
  const annualDrift = meanLogReturn * 365 + 0.5 * annualVol * annualVol;

  // Attempt to detect mean reversion (simplified)
  // Calculate autocorrelation of log returns
  let autocorr = 0;
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 1; i < logReturns.length - 1; i++) {
    numerator += (logReturns[i] - meanLogReturn) * (logReturns[i + 1] - meanLogReturn);
    denominator += Math.pow(logReturns[i] - meanLogReturn, 2);
  }
  
  autocorr = denominator > 0 ? numerator / denominator : 0;
  
  // If negative autocorrelation, suggest mean reversion
  let meanReversionSpeed: number | undefined;
  let longTermMean: number | undefined;
  
  if (autocorr < -0.1) {
    // Rough estimate of mean reversion speed
    meanReversionSpeed = -Math.log(1 + autocorr) * 365;
    longTermMean = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
  }

  return {
    drift: annualDrift,
    volatility: annualVol,
    meanReversionSpeed,
    longTermMean
  };
}

/**
 * Generates correlated price paths for two assets
 * 
 * @param params1 - Parameters for first asset
 * @param params2 - Parameters for second asset
 * @param correlation - Correlation coefficient (-1 to 1)
 * @returns Correlated price paths
 */
export function generateCorrelatedPaths(
  params1: Omit<MonteCarloParams, 'numSimulations'>,
  params2: Omit<MonteCarloParams, 'numSimulations'>,
  correlation: number,
  numSimulations: number
): {
  paths1: number[][];
  paths2: number[][];
} {
  const paths1: number[][] = [];
  const paths2: number[][] = [];
  
  const timeSteps = Math.ceil(params1.timeHorizon);
  const dt = params1.timeHorizon / 365 / timeSteps;
  
  const driftTerm1 = (params1.drift - 0.5 * params1.volatility ** 2) * dt;
  const volTerm1 = params1.volatility * Math.sqrt(dt);
  
  const driftTerm2 = (params2.drift - 0.5 * params2.volatility ** 2) * dt;
  const volTerm2 = params2.volatility * Math.sqrt(dt);

  for (let sim = 0; sim < numSimulations; sim++) {
    const path1: number[] = [params1.initialPrice];
    const path2: number[] = [params2.initialPrice];
    
    let price1 = params1.initialPrice;
    let price2 = params2.initialPrice;

    for (let i = 1; i <= timeSteps; i++) {
      // Generate correlated random variables
      const z1 = generateNormalRandom();
      const z2 = correlation * z1 + Math.sqrt(1 - correlation ** 2) * generateNormalRandom();
      
      // Update prices
      price1 = price1 * Math.exp(driftTerm1 + volTerm1 * z1);
      price2 = price2 * Math.exp(driftTerm2 + volTerm2 * z2);
      
      path1.push(price1);
      path2.push(price2);
    }
    
    paths1.push(path1);
    paths2.push(path2);
  }

  return { paths1, paths2 };
}
