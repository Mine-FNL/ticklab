# UniV3 LP Strategy Lab - Changes Summary

## Overview
Updated the application to use **FREE data sources only** - no API keys required for basic functionality.

## Changes Made

### 1. Replaced TheGraph with Free Data Sources

#### Before (Broken):
- TheGraph subgraphs (rate-limited/dead)
- Required API keys

#### After (Working):
- **DeFi Llama API** for pool TVL/volume/APR data (FREE, no key)
- **Direct RPC calls** for on-chain pool state (FREE public endpoints)
- **Hardcoded top pools** per chain for pool discovery

### 2. Updated Constants (`lib/constants.ts`)

#### Corrected Uniswap V3 Factory Addresses:
| Chain | Address |
|-------|---------|
| Ethereum | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Arbitrum | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Base | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| Optimism | `0x4A4e734057437Af293FEb3e074b795255BE0D3e9` |
| Polygon | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |

#### Added Free Public RPC Endpoints:
- Multiple free RPCs per chain for failover
- No API key required
- Automatic load balancing

#### Added Top Pools Per Chain:
- Hardcoded list of major Uniswap V3 pools
- ETH/USDC, WBTC/ETH, USDC/USDT, etc.
- 3-5 pools per chain

### 3. New DeFi Llama Client (`lib/data/defillama.ts`)

```typescript
// FREE API - no key required
GET https://api.llama.fi/pools/{chain}
```

Features:
- Fetch pool TVL, volume, APR
- Cache results (5 min TTL)
- Automatic retry on failure

### 4. Updated RPC Client (`lib/data/rpc.ts`)

#### New Features:
- **Failover support**: Multiple RPC endpoints per chain
- **Retry logic**: Automatic retry on failure
- **Free endpoints**: Uses public RPCs (LlamaRPC, Ankr, etc.)
- **Factory integration**: Query factory for pool addresses

#### New Functions:
- `getPoolFromFactory()` - Get pool address from factory
- `fetchPoolData()` - Fetch full pool data
- `executeWithFailover()` - RPC call with retry

### 5. New Pool Discovery (`lib/data/pools.ts`)

Uses multiple data sources:
1. Hardcoded top pools for quick discovery
2. RPC calls for on-chain state (sqrtPrice, liquidity, tick)
3. DeFi Llama for TVL/volume/APR metrics

### 6. Updated API Routes

#### `/api/tokens/resolve`
- Uses RPC instead of subgraph
- Validates ERC20 before fetching

#### `/api/pools`
- Uses new pool discovery
- Supports search by symbol

#### `/api/pools/[address]`
- Fetches from RPC + DeFi Llama
- Returns pool state + metrics

### 7. Updated Hooks

- `useToken.ts` - Uses RPC for token metadata
- `usePools.ts` - Uses new pool discovery
- `usePoolState.ts` - Uses RPC with auto-refresh

### 8. Updated Header Component

- Chain selector now shows all 5 chains
- Persists selected chain across pages
- Visual indicator for selected chain
- Mobile-friendly dropdown

### 9. Created Types File (`types/index.ts`)

Added all TypeScript types:
- Token, Pool, Position types
- Simulation, Backtest types
- API response types

## Data Flow

```
User Request
    ↓
API Route
    ↓
Pool Discovery
    ├── Hardcoded top pools (instant)
    ├── RPC call for on-chain state (sqrtPrice, liquidity)
    └── DeFi Llama for TVL/volume/APR
    ↓
Merged Response
```

## Free Data Sources Used

| Data Type | Source | Cost |
|-----------|--------|------|
| Pool TVL | DeFi Llama API | FREE |
| Pool Volume | DeFi Llama API | FREE |
| Pool APR | DeFi Llama API | FREE |
| Pool State (sqrtPrice) | Public RPC | FREE |
| Token Metadata | Public RPC | FREE |
| Position Data | Public RPC | FREE |

## Public RPC Endpoints Used

| Chain | Endpoints |
|-------|-----------|
| Ethereum | llamaRPC, Ankr, PublicNode |
| Arbitrum | Arbitrum official, Ankr, llamaRPC |
| Base | Base official, llamaRPC, PublicNode |
| Optimism | Optimism official, llamaRPC, Ankr |
| Polygon | Polygon official, Ankr, llamaRPC |

## Environment Variables

**No API keys required for basic functionality!**

Optional:
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` - For wallet connection (free at cloud.walletconnect.com)
- Custom RPC URLs - If you want to use your own endpoints

## Testing

All 5 chains are supported:
- ✅ Ethereum Mainnet
- ✅ Arbitrum
- ✅ Base
- ✅ Optimism
- ✅ Polygon

## Files Changed

| File | Change |
|------|--------|
| `lib/constants.ts` | Updated factory addresses, added free RPCs, top pools |
| `lib/data/defillama.ts` | NEW - DeFi Llama API client |
| `lib/data/rpc.ts` | Updated with failover, factory functions |
| `lib/data/pools.ts` | NEW - Pool discovery using multiple sources |
| `app/api/tokens/resolve/route.ts` | Uses RPC instead of subgraph |
| `app/api/pools/route.ts` | Uses new pool discovery |
| `app/api/pools/[address]/route.ts` | Uses RPC + DeFi Llama |
| `hooks/useToken.ts` | Uses RPC |
| `hooks/usePools.ts` | Uses new pool discovery |
| `hooks/usePoolState.ts` | Uses RPC |
| `components/layout/Header.tsx` | Updated chain selector |
| `types/index.ts` | NEW - TypeScript types |
| `package.json` | Added dependencies |
| `.env.local.template` | Updated for free data sources |

## Next Steps

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment (optional):
   ```bash
   cp .env.local.template .env.local
   # Only needed for wallet connection
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

The app will work immediately with free public data sources!
