/**
 * Historical Price Data - REAL Data from CoinGecko API
 * 
 * This module fetches REAL historical token prices from CoinGecko.
 * NO SYNTHETIC DATA - If the API fails, an error is thrown.
 * 
 * CoinGecko API (free tier):
 * - Rate limit: 10-30 calls/minute
 * - No API key required for basic endpoints
 */

import { COINGECKO_API, CACHE_TTL } from '@/lib/constants';

export interface PricePoint {
  timestamp: number;
  price: number;
}

// Cache for historical data
const historyCache = new Map<string, { data: PricePoint[]; timestamp: number }>();

// Common token address to CoinGecko ID mapping
// This is needed because CoinGecko uses IDs, not addresses
const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  // Ethereum Mainnet
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'weth',
  '0xa0b86a33e6441e0a421e56e4773c3c4b0db7e5b0': 'usd-coin', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'tether', // USDT
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin',
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'staked-ether', // wstETH
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'dai',
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'chainlink',
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap',
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 'matic-network',
  // Arbitrum (bridged tokens)
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'weth',
  '0xff970a61a04b1ca14834a43f5de4533ebdddbcc8': 'usd-coin',
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'tether',
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 'wrapped-bitcoin',
  // Base
  '0x4200000000000000000000000000000000000006': 'weth',
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'usd-coin',
  '0xc1cba3fcea344f92d9239c08c0568f6af8f1e5c9': 'coinbase-wrapped-staked-eth',
  // Optimism
  '0x4200000000000000000000000000000000000006': 'weth',
  '0x7f5c764cbc14f9669b88837ca1490cca17c31607': 'usd-coin',
  '0x68f180fcce6836688e9084f035309e29bf0a2095': 'wrapped-bitcoin',
  // Polygon
  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': 'weth',
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'usd-coin',
  '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6': 'wrapped-bitcoin',
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'tether',
};

/**
 * Get CoinGecko ID for a token address
 * 
 * @param tokenAddress - Token contract address
 * @returns CoinGecko ID or null if unknown
 */
function getCoinGeckoId(tokenAddress: string): string | null {
  const normalized = tokenAddress.toLowerCase();
  return TOKEN_TO_COINGECKO_ID[normalized] || null;
}

/**
 * Fetch historical prices from CoinGecko API
 * Returns REAL historical price data
 * 
 * @param tokenAddress - Token contract address
 * @param days - Number of days of history (1-365)
 * @returns Array of price points with timestamps
 * @throws Error if API fails or token not found
 */
export async function getTokenPriceHistory(
  tokenAddress: string,
  days: number = 30
): Promise<PricePoint[]> {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cacheKey = `price-${normalizedAddress}-${days}`;
  
  // Check cache
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL.COINGECKO_DATA) {
    return cached.data;
  }
  
  // Get CoinGecko ID for the token
  const coinId = getCoinGeckoId(tokenAddress);
  
  if (!coinId) {
    throw new Error(
      `Unknown token address: ${tokenAddress}. ` +
      `This token is not in the CoinGecko mapping. ` +
      `Please use a supported token (WETH, USDC, USDT, WBTC, etc.)`
    );
  }
  
  try {
    // Fetch from CoinGecko API
    const url = `${COINGECKO_API.BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('CoinGecko API rate limit exceeded. Please wait a moment and try again.');
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.prices || !Array.isArray(data.prices)) {
      throw new Error('Invalid response from CoinGecko API');
    }
    
    // Convert to PricePoint format
    const priceHistory: PricePoint[] = data.prices.map((item: [number, number]) => ({
      timestamp: item[0],
      price: item[1],
    }));
    
    if (priceHistory.length === 0) {
      throw new Error('No price data available from CoinGecko');
    }
    
    // Cache the result
    historyCache.set(cacheKey, { data: priceHistory, timestamp: Date.now() });
    
    return priceHistory;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to fetch price history: ${error}`);
  }
}

/**
 * Fetch current token price from CoinGecko
 * 
 * @param tokenAddress - Token contract address
 * @returns Current price in USD
 * @throws Error if API fails
 */
export async function getCurrentTokenPrice(tokenAddress: string): Promise<number> {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cacheKey = `current-price-${normalizedAddress}`;
  
  // Check cache (5 minute TTL for current price)
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data[0]?.price || 0;
  }
  
  const coinId = getCoinGeckoId(tokenAddress);
  
  if (!coinId) {
    throw new Error(`Unknown token address: ${tokenAddress}`);
  }
  
  try {
    const url = `${COINGECKO_API.BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data[coinId]?.usd) {
      throw new Error('Price not available from CoinGecko');
    }
    
    const price = data[coinId].usd;
    
    // Cache the result
    historyCache.set(cacheKey, { 
      data: [{ timestamp: Date.now(), price }], 
      timestamp: Date.now() 
    });
    
    return price;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to fetch current price: ${error}`);
  }
}

/**
 * Fetch historical prices for both tokens in a pool
 * Used for backtesting LP positions
 * 
 * @param token0Address - Token0 contract address
 * @param token1Address - Token1 contract address
 * @param days - Number of days of history
 * @returns Object with price histories for both tokens
 * @throws Error if either API call fails
 */
export async function getPoolPriceHistory(
  token0Address: string,
  token1Address: string,
  days: number = 30
): Promise<{
  token0Prices: PricePoint[];
  token1Prices: PricePoint[];
}> {
  // Fetch both in parallel
  const [token0Prices, token1Prices] = await Promise.all([
    getTokenPriceHistory(token0Address, days),
    getTokenPriceHistory(token1Address, days),
  ]);
  
  return { token0Prices, token1Prices };
}

/**
 * Calculate price ratio history (token1 price in terms of token0)
 * Used for LP backtesting
 * 
 * @param token0Prices - Token0 price history in USD
 * @param token1Prices - Token1 price history in USD
 * @returns Array of price ratios
 */
export function calculatePriceRatioHistory(
  token0Prices: PricePoint[],
  token1Prices: PricePoint[]
): PricePoint[] {
  // Align timestamps and calculate ratios
  const ratios: PricePoint[] = [];
  
  for (const p0 of token0Prices) {
    // Find closest price point for token1
    const p1 = token1Prices.reduce((closest, current) => {
      const currentDiff = Math.abs(current.timestamp - p0.timestamp);
      const closestDiff = Math.abs(closest.timestamp - p0.timestamp);
      return currentDiff < closestDiff ? current : closest;
    });
    
    if (p0.price > 0 && p1.price > 0) {
      ratios.push({
        timestamp: p0.timestamp,
        price: p1.price / p0.price, // Token1 price in terms of token0
      });
    }
  }
  
  return ratios;
}

/**
 * Clear history cache
 */
export function clearHistoryCache(): void {
  historyCache.clear();
}
