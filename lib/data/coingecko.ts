/**
 * Token to CoinGecko ID mapping
 * 
 * CoinGecko uses platform-specific contract addresses.
 * Format: chainId -> tokenAddress -> CoinGecko ID
 * 
 * Reference: https://www.coingecko.com/en/api
 */

// Token address -> CoinGecko ID mapping
// Add tokens here as needed
export const COINGECKO_IDS: Record<string, Record<number, string>> = {
  // Ethereum Mainnet (chainId: 1)
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { 1: 'weth' },           // WETH
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { 1: 'usd-coin' },        // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { 1: 'tether' },          // USDT
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { 1: 'wrapped-bitcoin' }, // WBTC
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': { 1: 'matic-network' },   // MATIC
  '0x514910771af9ca656af840dff83e8264ecf986ca': { 1: 'chainlink' },      // LINK
  '0xae78736cd615f374d3085123a210448e74fc6393': { 1: 'rocket-pool-eth' }, // rETH
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': { 1: 'staked-ether' },    // stETH
  '0xc00e94cb662c3520282e6f5717214004a7f26888': { 1: 'compound-governance-token' }, // COMP
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { 1: 'uniswap' },         // UNI
  '0x514910771af9ca656af840dff83e8264ecf986ca': { 1: 'chainlink' },      // LINK
  
  // Arbitrum (chainId: 42161)
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { 42161: 'weth' },        // WETH
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { 42161: 'usd-coin' },    // USDC
  '0xfd086bc7cd5c481dcc9c96ebe6a1a233e24197f0': { 42161: 'tether' },      // USDT
  '0x2f2a2543b76a4166549f7aab2e75bef01a8328ca': { 42161: 'wrapped-bitcoin' }, // WBTC
  '0x912ce59144191c1204e64559fe8253a0e49e6548': { 42161: 'arbitrum' },     // ARB
  
  // Base (chainId: 8453)
  '0x4200000000000000000000000000000000000006': { 8453: 'weth' },         // WETH
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { 8453: 'usd-coin' },      // USDC
  '0xfde4c96c8593536e31f229ea8f37b2ada2699b57': { 8453: 'tether' },       // USDT
  
  // Optimism (chainId: 10)
  '0x4200000000000000000000000000000000000042': { 10: 'weth' },            // WETH
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85': { 10: 'usd-coin' },       // USDC
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58f58': { 10: 'tether' },         // USDT
  '0x68f180fcce6836688e9084f035309e29bf0a209': { 10: 'wrapped-bitcoin' }, // WBTC
  '0x4200000000000000000000000000000000000042': { 10: 'weth' },            // WETH
  
  // Polygon (chainId: 137)
  '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': { 137: 'matic-network' }, // MATIC
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': { 137: 'usd-coin' },      // USDC
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': { 137: 'tether' },        // USDT
  '0x1bfd67037b42f73f46801769e5f1d204c31a130': { 137: 'wrapped-bitcoin' }, // WBTC
}

/**
 * Get CoinGecko ID for a token
 * 
 * @param tokenAddress - Token contract address (checksum or lowercase)
 * @param chainId - Chain ID
 * @returns CoinGecko ID or null if not found
 */
export function getCoinGeckoId(tokenAddress: string, chainId: number): string | null {
  return COINGECKO_IDS[tokenAddress.toLowerCase()]?.[chainId] || null
}

/**
 * Add a new token to the mapping
 */
export function addTokenMapping(tokenAddress: string, chainId: number, geckoId: string): void {
  const lowerAddress = tokenAddress.toLowerCase()
  if (!COINGECKO_IDS[lowerAddress]) {
    COINGECKO_IDS[lowerAddress] = {}
  }
  COINGECKO_IDS[lowerAddress][chainId] = geckoId
}
