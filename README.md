# UniV3 LP Strategy Lab

A production-grade research terminal for Uniswap V3 concentrated liquidity provision strategies.

**🎉 NOW WITH FREE DATA SOURCES - NO API KEYS REQUIRED!**

## Overview

**UniV3 LP Strategy Lab** is a comprehensive tool designed for serious DeFi strategists, treasury managers, and quantitative analysts to simulate, backtest, and monitor LP positions with institutional-grade precision.

### Key Features

- **Strategy Explorer**: Discover and analyze pools, understand risk/reward profiles
- **Historical Replay**: Backtest strategies against real market data
- **Live Monitoring**: Import and track actual positions with real-time analytics

## What's New: Free Data Sources

This app now uses **completely free data sources** - no API keys required!

| Data Source | Purpose | Cost |
|-------------|---------|------|
| **DeFi Llama API** | Pool TVL, volume, APR | FREE |
| **Public RPC Endpoints** | On-chain data (sqrtPrice, liquidity, ticks) | FREE |
| **Hardcoded Top Pools** | Pool discovery | FREE |

### Supported Chains

- ✅ **Ethereum Mainnet**
- ✅ **Arbitrum**
- ✅ **Base**
- ✅ **Optimism**
- ✅ **Polygon**

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Landing   │  │   Token/    │  │      Strategy           │  │
│  │    Page     │  │   Pool      │  │      Builder            │  │
│  └─────────────┘  │  Discovery  │  └─────────────────────────┘  │
│  ┌─────────────┐  └─────────────┘  ┌─────────────────────────┐  │
│  │   Results   │  ┌─────────────┐  │   Live Dashboard        │  │
│  │    Page     │  │ Historical  │  │   / Monitoring          │  │
│  └─────────────┘  │   Replay    │  └─────────────────────────┘  │
│                   └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Token     │  │    Pool     │  │      Simulation         │  │
│  │  Resolution │  │   Discovery │  │       Engine            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Wallet    │  │   Position  │  │      Backtest           │  │
│  │   Import    │  │  Analytics  │  │       Engine            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CALCULATION ENGINE                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Uniswap V3 │  │   Fee       │  │     Scenario            │  │
│  │    Math     │  │   Model     │  │       Grid              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Impermanent│  │   HODL      │  │    Monte Carlo          │  │
│  │    Loss     │  │ Benchmark   │  │    Simulation           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS 3.4+
- **UI Components**: shadcn/ui
- **State Management**: Zustand + TanStack Query
- **Charts**: Recharts
- **Wallet**: RainbowKit + wagmi + viem
- **Blockchain**: viem 2+ for on-chain reads

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/0xBingBong69/univ3-strategy-lab.git
cd univ3-strategy-lab
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Set up environment variables:
```bash
cp .env.local.template .env.local
```

> **Note**: The app works without any API keys! Environment variables are only needed if you want to use custom RPC endpoints or WalletConnect.

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Data Sources

### Free Public RPC Endpoints

The app uses multiple free RPC endpoints per chain for redundancy:

| Chain | Endpoints |
|-------|-----------|
| Ethereum | llamaRPC, Ankr, PublicNode |
| Arbitrum | Arbitrum official, Ankr, llamaRPC |
| Base | Base official, llamaRPC, PublicNode |
| Optimism | Optimism official, llamaRPC, Ankr |
| Polygon | Polygon official, Ankr, llamaRPC |

### DeFi Llama API

Used for pool metrics (TVL, volume, APR):
- Endpoint: `https://api.llama.fi/pools/{chain}`
- No API key required
- 5-minute cache

### Uniswap V3 Factory Addresses

| Chain | Factory Address |
|-------|-----------------|
| Ethereum | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Arbitrum | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Base | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| Optimism | `0x4A4e734057437Af293FEb3e074b795255BE0D3e9` |
| Polygon | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |

## Project Structure

```
app/
├── api/                    # API routes
│   ├── tokens/resolve/     # Token resolution (RPC)
│   ├── pools/              # Pool discovery (DeFi Llama + RPC)
│   ├── simulations/        # Simulation engine
│   ├── backtests/          # Backtest engine
│   ├── wallet/positions/   # Wallet position import
│   └── positions/          # Position analytics
├── (pages)/                # Page routes
│   ├── page.tsx           # Landing page
│   ├── explore/           # Token/pool discovery
│   ├── strategy/          # Strategy builder
│   ├── results/           # Results page
│   ├── backtest/          # Historical replay
│   ├── positions/         # Live positions
│   ├── compare/           # Compare strategies
│   └── library/           # Saved strategies

lib/
├── data/
│   ├── defillama.ts       # DeFi Llama API client
│   ├── rpc.ts             # RPC client with failover
│   └── pools.ts           # Pool discovery
├── univ3/                 # Uniswap V3 math
├── simulation/            # Simulation engine
└── constants.ts           # App constants
```

## API Routes

| Route | Method | Description | Data Source |
|-------|--------|-------------|-------------|
| `/api/tokens/resolve` | GET | Resolve token address | RPC |
| `/api/pools` | GET | Discover pools | DeFi Llama + RPC |
| `/api/pools/[address]` | GET | Get pool details | RPC |
| `/api/simulations` | POST | Run simulation | Calculated |
| `/api/backtests` | POST | Run backtest | Calculated |
| `/api/wallet/positions` | GET | Get wallet positions | RPC |
| `/api/positions/[id]/analytics` | GET | Get position analytics | RPC |

## Key Features

### 1. Strategy Explorer
- Discover pools by token address
- View pool metrics (TVL, volume, APR)
- Data quality warnings

### 2. Strategy Builder
- Configure deposit amount and token
- Set price range with visual feedback
- Rebalance settings
- Scenario configuration

### 3. Calculation Engine
- Uniswap V3 core math (price, tick, liquidity)
- Fee estimation with volume scenarios
- Impermanent loss calculations
- HODL benchmark comparisons

### 4. Simulation Engine
- Deterministic scenario grids
- Monte Carlo simulation
- Fee income projections

### 5. Historical Replay
- Backtest against historical data
- Equity curve analysis
- Performance attribution

### 6. Live Position Monitoring
- Wallet connection via RainbowKit
- Position import from NFT manager
- Real-time position analytics

## Environment Variables (Optional)

```env
# Optional: Custom RPC Endpoints
# If not set, the app will use free public RPCs
ETHEREUM_RPC_URL="https://eth.llamarpc.com"
ARBITRUM_RPC_URL="https://arb1.arbitrum.io/rpc"
BASE_RPC_URL="https://mainnet.base.org"
OPTIMISM_RPC_URL="https://mainnet.optimism.io"
POLYGON_RPC_URL="https://polygon-rpc.com"

# Optional: WalletConnect Project ID
# Get one free at: https://cloud.walletconnect.com
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=""
```

## Key Product Principles

✅ **No fake precision** - All estimates clearly labeled as projections  
✅ **Transparent data quality** - Warnings for low liquidity, sparse data  
✅ **Real data only** - No hardcoded demo values  
✅ **Clear assumptions** - All parameters user-configurable  
✅ **Educational** - Help users understand IL, fees, range selection  
✅ **Professional UX** - Dark institutional theme  
✅ **Mobile responsive** - Works on all devices  
✅ **Free data sources** - No API keys required  

## Performance

- Server-side computation for heavy calculations
- Intelligent caching with TTL
- Debounced input handling
- Lazy-loaded charts
- Multi-RPC failover

## License

MIT License - see LICENSE file for details

## Disclaimer

This tool is for research and educational purposes only. All projections are estimates based on historical data and assumptions. Past performance does not guarantee future results. Always do your own research (DYOR) before making investment decisions.

## Support

- GitHub Issues: [https://github.com/0xBingBong69/univ3-strategy-lab/issues](https://github.com/0xBingBong69/univ3-strategy-lab/issues)

---

Built with ❤️ for the DeFi community
