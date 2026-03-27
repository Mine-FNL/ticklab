# Free Data Sources Implementation

## Summary

The UniV3 LP Strategy Lab now uses **completely free data sources** - no API keys required for basic functionality!

## Data Sources

### 1. DeFi Llama API (FREE)
- **Purpose**: Pool TVL, volume, APR data
- **Endpoint**: `https://api.llama.fi/pools/{chain}`
- **Cost**: FREE
- **Rate Limits**: Reasonable for personal use
- **Cache**: 5 minutes

### 2. Public RPC Endpoints (FREE)
- **Purpose**: On-chain data (sqrtPrice, liquidity, ticks, token metadata)
- **Endpoints**: Multiple free RPCs per chain
- **Cost**: FREE
- **Failover**: Automatic retry with multiple endpoints

### 3. Hardcoded Top Pools (FREE)
- **Purpose**: Pool discovery without subgraphs
- **Data**: Major Uniswap V3 pools per chain
- **Cost**: FREE
- **Update**: Manual (can be updated periodically)

## Supported Chains

| Chain | Factory Address | Status |
|-------|-----------------|--------|
| Ethereum | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | ✅ Working |
| Arbitrum | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | ✅ Working |
| Base | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | ✅ Working |
| Optimism | `0x4A4e734057437Af293FEb3e074b795255BE0D3e9` | ✅ Working |
| Polygon | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | ✅ Working |

## Free RPC Endpoints

### Ethereum
- `https://eth.llamarpc.com`
- `https://rpc.ankr.com/eth`
- `https://ethereum.publicnode.com`

### Arbitrum
- `https://arb1.arbitrum.io/rpc`
- `https://rpc.ankr.com/arbitrum`
- `https://arbitrum.llamarpc.com`

### Base
- `https://mainnet.base.org`
- `https://base.llamarpc.com`
- `https://base.publicnode.com`

### Optimism
- `https://mainnet.optimism.io`
- `https://optimism.llamarpc.com`
- `https://rpc.ankr.com/optimism`

### Polygon
- `https://polygon-rpc.com`
- `https://rpc.ankr.com/polygon`
- `https://polygon.llamarpc.com`

## Features

### ✅ Working Features
- Token resolution via RPC
- Pool discovery (top pools per chain)
- Pool state fetching (sqrtPrice, liquidity, tick)
- Pool metrics (TVL, volume, APR from DeFi Llama)
- Position import from NFT manager
- Strategy simulation
- Backtesting (with synthetic data)
- Multi-chain support

### ⚠️ Limitations
- Backtesting uses synthetic data (real historical data requires paid sources)
- Pool discovery limited to hardcoded top pools
- No real-time price history

## Getting Started

```bash
# Install dependencies
npm install

# Run the app (no API keys needed!)
npm run dev
```

## Optional Configuration

If you want to use custom RPC endpoints or WalletConnect:

```bash
cp .env.local.template .env.local
# Edit .env.local with your settings
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         API ROUTES                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ /api/tokens │  │ /api/pools  │  │ /api/simulations    │  │
│  │ /resolve    │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  DeFi Llama API │  │  Public RPC     │  │  Hardcoded  │  │
│  │  (TVL/Volume)   │  │  (On-chain)     │  │  Top Pools  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### RPC Errors
If you see RPC errors, the app will automatically retry with alternative endpoints. If all fail:
1. Check your internet connection
2. Wait a moment and retry
3. The RPC endpoints may be temporarily down

### Missing Pool Data
If a pool is not showing up:
1. It may not be in our hardcoded list
2. Try entering the pool address directly
3. Check that you're on the correct chain

### Rate Limiting
If you hit rate limits:
1. The app has built-in caching (5 min for DeFi Llama, 30 sec for RPC)
2. Wait a few minutes before retrying
3. The app uses multiple RPC endpoints for failover

## Contributing

To add more pools to the hardcoded list, edit `lib/constants.ts`:

```typescript
export const TOP_POOLS_PER_CHAIN: Record<number, Array<{
  address: string;
  token0: { address: string; symbol: string; decimals: number };
  token1: { address: string; symbol: string; decimals: number };
  feeTier: number;
}>> = {
  [mainnet.id]: [
    // Add your pool here
    {
      address: '0x...',
      token0: { address: '0x...', symbol: 'TOKEN0', decimals: 18 },
      token1: { address: '0x...', symbol: 'TOKEN1', decimals: 6 },
      feeTier: 3000,
    },
  ],
};
```

## License

MIT License
