# Universal ERC20 Token Support

## Overview
The UniV3 Strategy Lab now supports ANY valid ERC20 token address. Users can paste any token contract address and the app will resolve its metadata (name, symbol, decimals) directly from the blockchain.

## Features

### 1. Universal Token Input
- **Input ANY ERC20 address**: `0x1234...abcd`
- **No predefined lists**: Works with any token, including new launches
- **Address validation**: Checks if input is a valid Ethereum address
- **Auto-resolution**: Fetches token metadata from contract

### 2. Token Resolution via RPC
**File: `lib/data/tokens.ts`**

```typescript
// Resolve ANY ERC20 token
const token = await resolveToken(chainId, '0x...');
// Returns: { name, symbol, decimals, address, verified }
```

**Process:**
1. Validate address format (0x + 40 hex chars)
2. Call token contract methods via RPC:
   - `name()` - Token name
   - `symbol()` - Token symbol  
   - `decimals()` - Token decimals
3. Cache result for 24 hours
4. Return token metadata

### 3. Price Lookup
**Multiple price sources:**

1. **CoinGecko API** (preferred)
   - Uses `/simple/token_price/{platform}` endpoint
   - Supports all major chains
   - Free tier: 10-30 calls/minute

2. **Pool Price Calculation** (fallback)
   - Finds common trading pair (USDC, WETH, USDT)
   - Calculates price from `sqrtPriceX96`
   - Works for any token with liquidity

### 4. Pool Discovery
**File: `lib/data/pools.ts`**

```typescript
// Find pool for ANY two tokens
const pool = await discoverPool(chainId, tokenA, tokenB, feeTier);
```

**Process:**
1. Resolve both tokens (get metadata)
2. Query Uniswap V3 Factory: `getPool(token0, token1, fee)`
3. If pool exists, fetch on-chain state
4. Return pool with current price, TVL, etc.

## UI Components

### TokenInput Component
**Features:**
- Text input for token address
- "Resolve" button to fetch metadata
- Shows token icon (first 2 letters of symbol)
- Displays name, symbol, decimals
- Error state for invalid addresses

```tsx
<TokenInput
  label="Token A Address"
  value={tokenA}
  onChange={setTokenA}
  onResolve={handleResolve}
  resolvedToken={tokenAData}
  isResolving={isResolvingA}
  error={tokenAError}
/>
```

### PoolSelector Component
**Features:**
- Two token address inputs
- Fee tier selector (optional)
- "Find Pool" button
- Shows discovered pool with:
  - Token pair (with icons)
  - Current price
  - TVL, volume, APR (from DeFi Llama)
  - Link to explorer

## Hooks

### useToken
```typescript
const { data: token, isLoading, error } = useToken(chainId, tokenAddress);

// Returns:
// {
//   address: string;
//   chainId: number;
//   name: string;
//   symbol: string;
//   decimals: number;
//   priceUSD?: number;
//   verified: boolean;
// }
```

### usePoolDiscovery
```typescript
const { data: pool, isLoading, error } = usePoolDiscovery(
  chainId,
  tokenA,
  tokenB,
  feeTier // optional
);

// Returns Pool or null if no pool exists
```

## Supported Chains

| Chain | ID | Factory Address |
|-------|----|-----------------|
| Ethereum | 1 | 0x1F98431c8aD98523631AE4a59f267346ea31F984 |
| Arbitrum | 42161 | 0x1F98431c8aD98523631AE4a59f267346ea31F984 |
| Base | 8453 | 0x33128a8fC17869897dcE68Ed026d694621f6FDfD |
| Optimism | 10 | 0x4A4e734057437Af293FEb3e074b795255BE0D3e9 |
| Polygon | 137 | 0x1F98431c8aD98523631AE4a59f267346ea31F984 |

## Usage Example

```tsx
import { useToken, usePoolDiscovery } from '@/hooks/useTokens';
import { PoolSelector } from '@/components/strategy/PoolSelector';

// In your component:
function StrategyBuilder() {
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  
  // Resolve tokens
  const { data: tokenAData } = useToken(1, tokenA);
  const { data: tokenBData } = useToken(1, tokenB);
  
  // Discover pool
  const { data: pool } = usePoolDiscovery(1, tokenA, tokenB);
  
  return (
    <PoolSelector
      chainId={1}
      onPoolSelect={(pool) => console.log(pool)}
    />
  );
}
```

## Error Handling

### Invalid Address
```
"Invalid Ethereum address: 0x123..."
```

### Not an ERC20 Contract
```
"Address 0x... is not a valid ERC20 token"
```

### Token Resolution Failed
```
"Failed to resolve token 0x...: RPC error"
```

### No Pool Found
```
"No Uniswap V3 pool exists for TOKEN_A / TOKEN_B"
"Create pool on Uniswap" (link to app.uniswap.org)
```

## Caching

### Token Metadata Cache
- **TTL**: 24 hours
- **Key**: `${chainId}:${tokenAddress}`
- **Rationale**: Token metadata (name, symbol, decimals) never changes

### Price Cache
- **TTL**: 30 seconds
- **Key**: `${chainId}:${tokenAddress}:price`
- **Rationale**: Prices change frequently

## Free Data Sources

| Data Type | Source | Rate Limit |
|-----------|--------|------------|
| Token Metadata | On-chain RPC | N/A |
| Token Price | CoinGecko API | 10-30/min |
| Pool Price | On-chain RPC | N/A |
| Pool TVL/Volume | DeFi Llama | 100/min |

## Files Changed

### New Files
- `lib/data/tokens.ts` - Token resolution
- `hooks/useTokens.ts` - Token hooks

### Modified Files
- `components/strategy/PoolSelector.tsx` - Universal token input UI
- `hooks/usePools.ts` - Updated to use token resolution

## Testing Checklist

- [ ] Enter valid token address → Resolves correctly
- [ ] Enter invalid address → Shows validation error
- [ ] Enter non-ERC20 address → Shows "not a token" error
- [ ] Enter new/unlisted token → Works (no CoinGecko price)
- [ ] Find pool with any two tokens → Works if pool exists
- [ ] No pool exists → Shows "Create pool" link
- [ ] Switch chains → Works on all supported chains
- [ ] Cache works → Second resolve is instant
