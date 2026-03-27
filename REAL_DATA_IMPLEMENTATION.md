# UniV3 Strategy Lab - REAL DATA Implementation

## Overview
Complete rewrite to use ONLY real, live data from free APIs and blockchain.
NO mock data. NO hardcoded pools. NO synthetic data.

## Changes Made

### 1. Removed Hardcoded Pools
**File: `lib/constants.ts`**
- ❌ REMOVED: `TOP_POOLS_PER_CHAIN` - All hardcoded pool addresses deleted
- ✅ KEPT: Factory addresses, ABIs, RPC endpoints, fee tier mappings
- ✅ ADDED: CoinGecko API configuration

### 2. Pool Discovery via Factory Contract
**File: `lib/data/pools.ts`** (completely rewritten)

```typescript
// Query factory contract on-chain for ANY token pair
async function findPool(
  chainId: number,
  tokenA: string,
  tokenB: string,
  feeTier: number
): Promise<string | null>

// Discover pool with auto fee tier detection
async function discoverPool(
  chainId: number,
  tokenA: string,
  tokenB: string,
  feeTier?: number
): Promise<Pool | null>
```

**Behavior:**
- Calls `factory.getPool(token0, token1, fee)` via RPC
- Returns pool address if exists, `null` if pool doesn't exist
- If no fee tier specified, tries all: [3000, 500, 10000, 100]
- Throws error on RPC failure (NO fallbacks)

### 3. Real Historical Prices - CoinGecko API
**File: `lib/data/history.ts`** (new file)

```typescript
// Fetch REAL historical prices from CoinGecko
async function getTokenPriceHistory(
  tokenAddress: string,
  days: number
): Promise<PricePoint[]>

// Fetch prices for both tokens in a pool
async function getPoolPriceHistory(
  token0Address: string,
  token1Address: string,
  days: number
): Promise<{ token0Prices: PricePoint[]; token1Prices: PricePoint[] }>
```

**Supported Tokens:**
- WETH, USDC, USDT, WBTC, wstETH, DAI, LINK, UNI, MATIC
- Bridged tokens on Arbitrum, Base, Optimism, Polygon

**Error Handling:**
- Throws error if token not in mapping
- Throws error if API rate limit exceeded
- Throws error if no price data available
- NO synthetic data generation

### 4. Real Pool Metrics - DeFi Llama API
**File: `lib/data/defillama.ts`** (rewritten)

```typescript
// Fetch REAL metrics from DeFi Llama
async function getPoolMetrics(
  chainId: number,
  poolAddress: string
): Promise<{ tvlUsd: number; volumeUsd1d?: number; apy?: number }>
```

**Behavior:**
- Fetches live TVL, volume, APR from DeFi Llama
- Throws error on API failure
- NO fallback to hardcoded values

### 5. Updated Hooks
**File: `hooks/usePools.ts`** (rewritten)

```typescript
// Discover pool for token pair
usePoolDiscovery(chainId, tokenA, tokenB, feeTier?)

// Find pool address only
useFindPoolAddress(chainId, tokenA, tokenB, feeTier)

// Get pool by known address
usePoolByAddress(chainId, poolAddress)

// Validate token address
useTokenValidation(chainId, tokenAddress)
```

**File: `hooks/useBacktest.ts`** (rewritten)

```typescript
// Run backtest with REAL historical data
useBacktest()

// Fetch price history for visualization
usePriceHistory(token0Address, token1Address, days)
```

**Behavior:**
- Fetches real prices from CoinGecko
- Runs backtest calculation on real data
- Returns error if historical data unavailable
- NO synthetic price generation

### 6. PoolSelector Component
**File: `components/strategy/PoolSelector.tsx`** (rewritten)

**UI Changes:**
- Two token address inputs (with validation)
- Fee tier selector (optional, defaults to auto)
- "Discover Pool" button queries factory
- Shows "No pool found" if factory returns address(0)
- Shows error with retry button on failure
- Displays discovered pool with real-time price

**States:**
1. **Input**: User enters token addresses
2. **Validating**: Validates token contracts on-chain
3. **Discovering**: Queries factory contract
4. **Found**: Shows pool with current price, TVL, APR
5. **Not Found**: Shows "No pool exists" message
6. **Error**: Shows error with retry option

### 7. Strategy Page
**File: `app/(pages)/strategy/page.tsx`** (updated)

**Features:**
- Pool discovery via PoolSelector
- Price range configuration with current price indicator
- Time horizon selection
- Real price history preview
- Backtest with real historical data
- Results display (return, fees, time in range)

## Data Sources

### On-Chain (RPC)
- **Pool Discovery**: Uniswap V3 Factory `getPool()`
- **Token Metadata**: ERC20 `symbol()`, `name()`, `decimals()`
- **Pool State**: `slot0()` (sqrtPriceX96, tick), `liquidity()`
- **RPC Endpoints**: LlamaRPC, Ankr, PublicNode (free, no key)

### APIs (Free Tier)
- **DeFi Llama**: `https://api.llama.fi/pools/{chain}`
  - TVL, volume, APR for pools
  - Rate limit: ~100 req/min
  - No API key required

- **CoinGecko**: `https://api.coingecko.com/api/v3`
  - Historical prices: `/coins/{id}/market_chart`
  - Current prices: `/simple/price`
  - Rate limit: 10-30 req/min
  - No API key required for basic endpoints

## Error Handling

### Pool Discovery Errors
```
"Invalid token address 0x..."
"Failed to fetch pool data for 0x..."
"No pool found" (factory returned address(0))
"All RPC endpoints failed"
```

### Historical Data Errors
```
"Unknown token address: 0x..."
"CoinGecko API rate limit exceeded"
"No price data available for the specified date range"
"Insufficient price data for backtest"
```

### Metrics Errors
```
"Pool 0x... not found in DeFi Llama data"
"DeFi Llama API error: 429"
```

## Usage Example

```tsx
// Discover a pool
const { data: pool, isLoading, error } = usePoolDiscovery(
  1, // Ethereum
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  '0xA0b86a33E6441e0A421e56E4773C3C4b0Db7E5b0', // USDC
  3000 // 0.3% fee tier (optional)
);

// Run backtest
const backtest = useBacktest();
const result = await backtest.mutateAsync({
  chainId: 1,
  poolAddress: pool.address,
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  depositAmount: 10000,
  lowerPrice: 1500,
  upperPrice: 2500,
  depositToken: 'usd',
});
```

## Testing Checklist

- [ ] Enter invalid token address → Shows validation error
- [ ] Enter valid tokens with no pool → Shows "No pool found"
- [ ] Enter valid tokens with existing pool → Shows pool data
- [ ] Check current price matches Uniswap UI
- [ ] Run backtest → Uses real CoinGecko data
- [ ] Disconnect internet → Shows error with retry
- [ ] Rate limit exceeded → Shows appropriate error
- [ ] Switch chains → Works for all supported chains

## Free Data Sources Summary

| Data Type | Source | Endpoint | Rate Limit |
|-----------|--------|----------|------------|
| Pool Discovery | On-chain RPC | Factory.getPool() | N/A |
| Token Metadata | On-chain RPC | ERC20 calls | N/A |
| Current Price | On-chain RPC | Pool.slot0() | N/A |
| Pool TVL/Volume | DeFi Llama | /pools/{chain} | 100/min |
| Historical Prices | CoinGecko | /market_chart | 10-30/min |

## NO FALLBACKS POLICY

If any data source fails:
- ✅ Show error message
- ✅ Provide retry button
- ❌ DO NOT use hardcoded data
- ❌ DO NOT use synthetic data
- ❌ DO NOT use mock data
- ❌ DO NOT use generated data

All data displayed is REAL and LIVE from the specified sources.
