/**
 * useBacktest Hook - REAL Historical Data Only
 * 
 * Runs backtests using REAL historical prices from CoinGecko API.
 * NO SYNTHETIC DATA - If historical data cannot be fetched, an error is returned.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { BacktestResult, BacktestParams } from '@/types';
import { getPoolPriceHistory, calculatePriceRatioHistory, PricePoint } from '@/lib/data/history';
import { getPoolByAddress } from '@/lib/data/pools';

export interface BacktestInput {
  chainId: number;
  poolAddress: string;
  startDate: Date;
  endDate: Date;
  depositAmount: number;
  lowerPrice: number;
  upperPrice: number;
  depositToken: 'token0' | 'token1' | 'usd';
}

export interface BacktestOutput {
  totalReturn: number;
  hodlReturn: number;
  excessReturn: number;
  totalFees: number;
  realizedIL: number;
  gasCosts: number;
  timeInRange: number;
  priceHistory: PricePoint[];
  equityCurve: Array<{
    timestamp: number;
    lpValue: number;
    hodlValue: number;
    fees: number;
  }>;
}

/**
 * Run a backtest using REAL historical price data
 * 
 * @param input - Backtest parameters
 * @returns Backtest results with real data
 * @throws Error if historical data cannot be fetched
 */
async function runBacktestWithRealData(input: BacktestInput): Promise<BacktestOutput> {
  // Fetch pool data to get token addresses
  const pool = await getPoolByAddress(input.chainId, input.poolAddress);
  
  // Calculate days for historical data
  const days = Math.ceil((input.endDate.getTime() - input.startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (days < 1) {
    throw new Error('Backtest period must be at least 1 day');
  }
  
  if (days > 365) {
    throw new Error('Backtest period cannot exceed 365 days (CoinGecko free tier limit)');
  }
  
  // Fetch REAL historical prices from CoinGecko
  const { token0Prices, token1Prices } = await getPoolPriceHistory(
    pool.token0.address,
    pool.token1.address,
    days
  );
  
  // Calculate price ratio history (token1 price in terms of token0)
  const priceRatioHistory = calculatePriceRatioHistory(token0Prices, token1Prices);
  
  if (priceRatioHistory.length === 0) {
    throw new Error('Insufficient price data for backtest');
  }
  
  // Filter to the requested date range
  const startTime = input.startDate.getTime();
  const endTime = input.endDate.getTime();
  
  const filteredPrices = priceRatioHistory.filter(
    p => p.timestamp >= startTime && p.timestamp <= endTime
  );
  
  if (filteredPrices.length === 0) {
    throw new Error('No price data available for the specified date range');
  }
  
  // Run backtest calculation
  const entryPrice = filteredPrices[0].price;
  const results = calculateBacktest(
    filteredPrices,
    entryPrice,
    input.lowerPrice,
    input.upperPrice,
    input.depositAmount,
    pool.feeTier
  );
  
  return {
    ...results,
    priceHistory: filteredPrices,
  };
}

/**
 * Calculate backtest results from price history
 */
function calculateBacktest(
  prices: PricePoint[],
  entryPrice: number,
  lowerPrice: number,
  upperPrice: number,
  depositAmount: number,
  feeTier: number
): Omit<BacktestOutput, 'priceHistory'> {
  let lpValue = depositAmount;
  let hodlValue = depositAmount;
  let totalFees = 0;
  let timeInRange = 0;
  
  const equityCurve: BacktestOutput['equityCurve'] = [];
  
  // Calculate initial token amounts (50/50 split)
  const initialToken0Amount = (depositAmount / 2) / entryPrice;
  const initialToken1Amount = depositAmount / 2;
  
  for (let i = 0; i < prices.length; i++) {
    const price = prices[i].price;
    const prevPrice = i > 0 ? prices[i - 1].price : entryPrice;
    
    // Check if price is in range
    const inRange = price >= lowerPrice && price <= upperPrice;
    
    if (inRange) {
      timeInRange++;
      
      // Calculate fees earned (simplified model)
      // Fees are proportional to price movement and fee tier
      const priceChange = Math.abs(price - prevPrice) / prevPrice;
      const dailyFee = depositAmount * (feeTier / 1_000_000) * priceChange;
      totalFees += dailyFee;
    }
    
    // Calculate LP value based on position in range
    let currentLpValue: number;
    if (price < lowerPrice) {
      // All in token0
      currentLpValue = initialToken0Amount * price + initialToken1Amount * (lowerPrice / entryPrice);
    } else if (price > upperPrice) {
      // All in token1
      currentLpValue = initialToken0Amount * upperPrice + initialToken1Amount;
    } else {
      // In range - calculate based on current price
      const ratio = (price - lowerPrice) / (upperPrice - lowerPrice);
      const token0Value = initialToken0Amount * (1 - ratio) * price;
      const token1Value = initialToken1Amount * ratio;
      currentLpValue = token0Value + token1Value;
    }
    
    // HODL value (just hold the initial 50/50 split)
    const currentHodlValue = initialToken0Amount * price + initialToken1Amount;
    
    lpValue = currentLpValue + totalFees;
    hodlValue = currentHodlValue;
    
    equityCurve.push({
      timestamp: prices[i].timestamp,
      lpValue,
      hodlValue,
      fees: totalFees,
    });
  }
  
  const finalPrice = prices[prices.length - 1].price;
  const totalReturn = (lpValue - depositAmount) / depositAmount;
  const hodlReturn = (hodlValue - depositAmount) / depositAmount;
  const excessReturn = totalReturn - hodlReturn;
  const realizedIL = hodlReturn - totalReturn;
  
  return {
    totalReturn,
    hodlReturn,
    excessReturn,
    totalFees,
    realizedIL,
    gasCosts: 0, // Would need gas price data
    timeInRange: timeInRange / prices.length,
    equityCurve,
  };
}

/**
 * Hook to run a backtest with real historical data
 * @returns Mutation result
 */
export function useBacktest() {
  return useMutation<BacktestOutput, Error, BacktestInput>({
    mutationFn: runBacktestWithRealData,
  });
}

/**
 * Hook to fetch historical price data for a pool
 * 
 * @param token0Address - Token0 address (null if not ready)
 * @param token1Address - Token1 address (null if not ready)
 * @param days - Number of days of history
 * @returns Query result with price history
 */
export function usePriceHistory(
  token0Address: string | null,
  token1Address: string | null,
  days: number = 30
) {
  return useQuery<{
    token0Prices: PricePoint[];
    token1Prices: PricePoint[];
    priceRatios: PricePoint[];
  }, Error>({
    queryKey: ['price-history', token0Address, token1Address, days],
    queryFn: async () => {
      if (!token0Address || !token1Address) {
        throw new Error('Both token addresses are required');
      }
      
      const { token0Prices, token1Prices } = await getPoolPriceHistory(
        token0Address,
        token1Address,
        days
      );
      
      const priceRatios = calculatePriceRatioHistory(token0Prices, token1Prices);
      
      return { token0Prices, token1Prices, priceRatios };
    },
    enabled: !!token0Address && !!token1Address,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });
}

// Legacy hooks for compatibility - these will need API routes to be implemented

/**
 * Hook to fetch a cached backtest result
 * @param backtestId - Backtest ID
 * @returns Query result
 */
export function useBacktestResult(backtestId: string | null) {
  return useQuery({
    queryKey: ['backtest', backtestId],
    queryFn: async () => {
      const response = await fetch(`/api/backtests/${backtestId}`);
      if (!response.ok) throw new Error('Failed to fetch backtest');
      return response.json() as Promise<BacktestResult>;
    },
    enabled: !!backtestId,
    staleTime: Infinity,
  });
}

/**
 * Hook to fetch user's backtests
 * @param userId - User ID (null for anonymous)
 * @returns Query result with backtests array
 */
export function useUserBacktests(userId: string | null) {
  return useQuery({
    queryKey: ['user-backtests', userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/backtests`);
      if (!response.ok) throw new Error('Failed to fetch backtests');
      return response.json() as Promise<BacktestResult[]>;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
