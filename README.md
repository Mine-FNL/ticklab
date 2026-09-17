# UniV3 LP Strategy Lab

A research terminal for Uniswap V3 concentrated-liquidity LP strategies. Built on real
data only — no mocks, no fabricated pools, no paid APIs.

**Backend data sources are FREE.** No API keys required.

## ⚠️ Read this before deploying capital

The simulator's accuracy against historical ground-truth LP P&L was measured in
[`NORTH_STAR_REPORT.md`](./NORTH_STAR_REPORT.md). As of the most recent run:

- **15 of 18 pools** completed the validation (3 DeFi Llama coverage gaps).
- **Median absolute error: 1.55 pp** (over a 30-day cumulative window).
- **Mean absolute error: 3.3 pp.** **Max absolute error: 13.2 pp.**
- **% within ±20% relative error: 0%** (target was ≥ 80%). The relative
  metric is dominated by pools whose GT cumulative return is near zero;
  the absolute-error metric is the one to watch.

**The simulator is directionally correct and within ~2-3 pp of ground truth
on a 30-day cumulative-return basis for most pools.** Treat projections as
ranges, not point estimates. The validation harness (`npm run
validate:northstar`) is reproducible end-to-end against real data.

## Overview

**UniV3 LP Strategy Lab** is a research tool for serious DeFi strategists and
quantitative analysts to simulate, backtest, and monitor LP positions.

### Key Features

- **Strategy Explorer**: Discover and analyze pools, understand risk/reward profiles
- **Historical Replay**: Backtest strategies against real market data
- **Confidence Bands**: Type-7 percentile bands + bootstrap on every backtest
- **Pre-Deposit Checklist**: 10 red-flag rules with a severity ladder
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

### 5. Historical Replay + Confidence Bands + Pre-Deposit Checklist
- Backtest against historical data
- Equity curve analysis with confidence bands (P5/P50/P95 via bootstrap)
- Pre-deposit checklist with 10 red-flag rules and severity ladder

### 6. Validation Harness (Honest Measurement)

The simulator is verified end-to-end against real historical data:

```bash
npm run validate:northstar              # local — prints results, exits 0
npm run validate:northstar:ci           # CI — exits non-zero if star regressed
```

The harness runs the simulator across 20 V3 pools spanning major pairs,
stables, mid-cap ETH pairs, and volatile tokens, against a ground-truth LP
replay computed from real DeFi Llama daily fees + Binance OHLC. See
[`NORTH_STAR_REPORT.md`](./NORTH_STAR_REPORT.md) for the latest numbers,
the methodology, and what's required to actually reach the ±5% APR accuracy
target (per-swap historical events from The Graph / Covalent need an API key).

### 7. Live Position Monitoring
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

✅ **No fake precision** - All estimates are clearly labeled as projections. Confidence bands are returned on every backtest so users see uncertainty.
✅ **Transparent data quality** - Warnings for low liquidity, sparse data, missing OHLC
✅ **Real data only** - No hardcoded demo values
✅ **Measured accuracy** - The north-star validation harness runs against ground-truth LP P&L and reports honestly when the simulator is off
✅ **Clear assumptions** - All parameters user-configurable
✅ **Educational** - Help users understand IL, fees, range selection
✅ **Professional UX** - Dark institutional theme
✅ **Mobile responsive** - Works on all devices
✅ **Free data sources** - No API keys required

## Accuracy Limits (Read Before Sizing Capital)

The simulator's fee model is intentionally simple — it projects using current
volume + fee tier. It does not yet model:

- **Tick-distribution within a position** — fees accrue non-linearly across the range
- **Concentrated-LP IL** — the closed-form `sqrt(r) - (r+1)/2` approximation
  assumes a 50/50 position; for tight ranges this can be off by 2-3×.
- **Per-swap fee accrual** — daily aggregates hide intra-day volume spikes.

Reaching the ±5% APR accuracy bar requires per-swap historical events, which
in turn requires an API key on The Graph's decentralized gateway or Covalent
GoldRush. See [`NORTH_STAR_REPORT.md`](./NORTH_STAR_REPORT.md) for the gap
analysis and what changes when those land.

## Performance

- Server-side computation for heavy calculations
- Intelligent caching with TTL
- Debounced input handling
- Lazy-loaded charts
- Multi-RPC failover

## License

MIT License - see LICENSE file for details

## Disclaimer

This tool is for research and educational purposes only. Projections are
estimates based on historical data and assumptions, and the simulator's
accuracy is bounded by the limitations described in **Accuracy Limits** above
and in [`NORTH_STAR_REPORT.md`](./NORTH_STAR_REPORT.md). **Do not use this
tool to size capital on individual positions.** Past performance does not
guarantee future results. Always do your own research (DYOR) before making
investment decisions.

## Support

- GitHub Issues: [https://github.com/0xBingBong69/univ3-strategy-lab/issues](https://github.com/0xBingBong69/univ3-strategy-lab/issues)

---

Built with ❤️ for the DeFi community
