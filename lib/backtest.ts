/**
 * Historical Backtest Engine for UniV3 Strategy Lab
 * 
 * Simulates LP strategy performance using historical price data.
 * Calculates IL, fees, rebalancing impact, and compares to HODL.
 */

import { calculateIL } from './il'
import { estimateFees } from './fee-model'
import { tickToPrice, sqrtPriceToTick } from './lp-math'
import { getCoinGeckoId } from './data/coingecko'

export interface BacktestParams {
  // Pool
  poolAddress: string
  chainId: number
  
  // Strategy
  lowerTick: number
  upperTick: number
  depositUSD: number
  
  // Time window
  startDate: Date
  endDate: Date
  
  // Assumptions
  rebalanceMode: 'none' | 'periodic' | 'threshold'
  rebalanceThreshold?: number  // % from center
  gasCostPerRebalance?: number
}

export interface DailySnapshot {
  date: Date
  price: number              // token1/token0 (e.g., ETH price)
  hodlValue: number          // value if held
  lpValue: number            // LP position value
  feesCumulative: number     // fees earned so far
  ilCumulative: number       // IL experienced so far
  netReturn: number           // fees - IL
  inRange: boolean
  rebalanced: boolean
}

export interface BacktestResult {
  // Parameters
  pool: string
  startDate: Date
  endDate: Date
  lowerTick: number
  upperTick: number
  
  // Summary metrics
  totalFees: number
  totalIL: number
  netReturn: number          // net LP return %
  hodlReturn: number         // HODL return %
  excessReturn: number       // LP - HODL
  
  // Performance
  sharpeRatio?: number
  maxDrawdown?: number
  
  // Rebalancing
  rebalanceCount: number
  totalGasCost: number
  
  // Time stats
  timeInRangePercent: number
  timeOutOfRangePercent: number
  
  // Daily breakdown
  dailyData: DailySnapshot[]
}

// Historical price data interface
export interface PricePoint {
  timestamp: number
  price: number
}

// Chain to CoinGecko platform mapping
const CHAIN_TO_GECKO: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  8453: 'base',
  10: 'optimism',
  137: 'polygon',
}

/**
 * Fetch historical price data from CoinGecko
 * Uses the free tier API with daily granularity
 */
export async function fetchPriceHistory(
  tokenAddress: string,
  chainId: number,
  startDate: Date,
  endDate: Date
): Promise<PricePoint[]> {
  const geckoChain = CHAIN_TO_GECKO[chainId]
  if (!geckoChain) throw new Error(`Unsupported chain: ${chainId}`)
  
  // Get CoinGecko ID from token address
  const geckoId = getCoinGeckoId(tokenAddress, chainId)
  if (!geckoId) throw new Error('Need token->CoinGecko ID mapping for historical prices')
  
  const startTs = Math.floor(startDate.getTime() / 1000)
  const endTs = Math.floor(endDate.getTime() / 1000)
  
  // CoinGecko market chart API
  // Returns prices in USD with timestamps
  const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&from=${startTs}&to=${endTs}&interval=daily`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('CoinGecko rate limit exceeded. Try again later or use an API key.')
      }
      throw new Error(`CoinGecko API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.prices || !Array.isArray(data.prices)) {
      throw new Error('Invalid response from CoinGecko')
    }
    
    return data.prices.map(([timestamp, price]: [number, number]) => ({
      timestamp: Math.floor(timestamp / 1000), // Convert ms to seconds
      price,
    }))
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Failed to fetch price history')
  }
}

/**
 * Run backtest with historical price data
 */
export async function runBacktest(
  params: BacktestParams,
  priceHistory: PricePoint[]
): Promise<BacktestResult> {
  const snapshots: DailySnapshot[] = []
  let totalFees = 0
  let totalIL = 0
  let rebalanceCount = 0
  let totalGasCost = 0
  let inRangeDays = 0
  
  // Entry values
  const entryPrice = priceHistory[0]?.price || 0
  const entryValue = params.depositUSD
  
  // Track position
  let currentLowerTick = params.lowerTick
  let currentUpperTick = params.upperTick
  
  // Calculate daily fee rate (simplified model)
  // Uses 0.03% of position value per day as an approximation
  // Real implementation would use actual pool volume data
  const dailyFeeRate = 0.0003 * (params.depositUSD / 1_000_000)
  
  for (let i = 1; i < priceHistory.length; i++) {
    const { timestamp, price } = priceHistory[i]
    const date = new Date(timestamp * 1000)
    
    // Check if current price is within our tick range
    const currentTick = sqrtPriceToTick(BigInt(Math.floor(price * 2**96)))
    const inRange = currentTick >= currentLowerTick && currentTick <= currentUpperTick
    
    if (inRange) inRangeDays++
    
    // Calculate daily fees earned when in range
    const dayFee = inRange ? dailyFeeRate : 0
    totalFees += dayFee
    
    // Calculate IL from entry price
    const ilCalc = calculateIL(entryPrice, price, totalFees, totalGasCost)
    totalIL = ilCalc.il
    
    // LP value = initial deposit + fees earned - IL - gas costs
    const lpValue = entryValue + totalFees - totalIL - totalGasCost
    
    // HODL value = initial deposit * price ratio
    const hodlValue = entryValue * (price / entryPrice)
    
    // Check rebalance conditions
    let rebalanced = false
    if (params.rebalanceMode !== 'none' && i > 0) {
      const prevPrice = priceHistory[i - 1].price
      const priceMove = Math.abs((price - prevPrice) / prevPrice)
      
      if (params.rebalanceMode === 'threshold' && priceMove > (params.rebalanceThreshold || 0.05)) {
        // Rebalance - shift range with price
        const tickShift = Math.round(Math.log(price / prevPrice) / Math.log(1.0001))
        currentLowerTick += tickShift
        currentUpperTick += tickShift
        rebalanced = true
        rebalanceCount++
        totalGasCost += params.gasCostPerRebalance || 50
      }
    }
    
    snapshots.push({
      date,
      price,
      hodlValue,
      lpValue,
      feesCumulative: totalFees,
      ilCumulative: totalIL,
      netReturn: ((lpValue - entryValue) / entryValue) * 100,
      inRange,
      rebalanced,
    })
  }
  
  // Final values
  const finalSnapshot = snapshots[snapshots.length - 1]
  const finalLpValue = finalSnapshot?.lpValue || 0
  const finalHodlValue = finalSnapshot?.hodlValue || 0
  
  // Calculate excess return (LP vs HODL)
  const netReturn = ((finalLpValue - entryValue) / entryValue) * 100
  const hodlReturn = ((finalHodlValue - entryValue) / entryValue) * 100
  const excessReturn = netReturn - hodlReturn
  
  // Calculate Sharpe ratio (simplified)
  let sharpeRatio: number | undefined
  if (snapshots.length > 1) {
    const returns = snapshots.map(s => s.netReturn)
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    const stdDev = Math.sqrt(variance)
    sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0
  }
  
  // Calculate max drawdown
  let maxDrawdown = 0
  let peak = entryValue
  for (const snapshot of snapshots) {
    if (snapshot.lpValue > peak) peak = snapshot.lpValue
    const drawdown = (peak - snapshot.lpValue) / peak
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  
  return {
    pool: params.poolAddress,
    startDate: params.startDate,
    endDate: params.endDate,
    lowerTick: params.lowerTick,
    upperTick: params.upperTick,
    totalFees,
    totalIL,
    netReturn,
    hodlReturn,
    excessReturn,
    sharpeRatio,
    maxDrawdown: maxDrawdown * 100,
    rebalanceCount,
    totalGasCost,
    timeInRangePercent: snapshots.length > 0 ? inRangeDays / snapshots.length : 0,
    timeOutOfRangePercent: snapshots.length > 0 ? (snapshots.length - inRangeDays) / snapshots.length : 0,
    dailyData: snapshots,
  }
}
