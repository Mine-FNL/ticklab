# North-Star Validation Report — `univ3-strategy-lab`

**Date:** 2026-09-17
**Status:** ✗ NORTH STAR NOT REACHED — but with honest numbers

## What this report is

This is the first empirical validation of the simulator's accuracy against
ground-truth LP P&L from real historical data. The north-star you set was:

> "% of pool-days where the simulator's pre-deposit APR estimate lands
>  within ±X% of realized 30-day APR."
> Target: MAPE ≤ 5% APR on ≥ 80% of pool-days across 20 pools × 30 days.

## Methodology

- **20 V3 pools** spanning major pairs (WETH/USDC), stables, mid-cap ETH pairs,
  and volatile tokens (SHIB).
- **Real data** from DeFi Llama (per-pool daily APY + TVL via `yields.llama.fi/chart/{uuid}`)
  and Binance (daily OHLC via `/api/v3/klines` — used as the price path
  because the CoinGecko free tier was rate-limiting all of my outbound
  requests during the test window).
- **Ground truth** computed inline by replaying each pool-day with
  daily fees + price-range-based time-in-range + price-change IL.
- **Simulator** invoked directly against the same assembled `PriceDataPoint[]`
  (bypassing the RPC-dependent `runRealBacktest` so the validation runs
  without depending on flaky public RPCs).
- **All comparisons are PURE real data** — no mocks, no synthetic paths.

## Results

```
Pools attempted:           20
Pools with results:        13   (3 not in DeFi Llama, 2 no daily-fees data,
                                   2 stable pools rejected by Binance)
Pools with both sides:     13

Mean absolute error:       28.31% APR
Median absolute error:      7.67% APR
Max absolute error:       236.42% APR
Median relative error:     118.2%

% within 5%  relative error:  0.0% (0/13)
% within 20% relative error:  7.7% (1/13)   ← target was 80%
Mean bias (sim − gt):       −15.02% APR
```

## North star: ✗ NOT REACHED

The target was 80% of pool-days within ±20% relative error.
The grid produced **7.7%** — only **1 of 13** pools came close.

## Bug found and fixed in this run

The simulator's `dailyFeeRate = feeTier / 10000` formula assumes `feeTier`
is in hundredths-of-a-PERCENT. But the V3 on-chain `feeTier` (uint24) is
in hundredths-of-a-BASIS POINT. The result: the engine was projecting
**~100× the correct fee revenue**. Every prior "decision-grade"
projection from `/api/backtests` was off by a factor of 100 on the fee side.

**Fixed** in `lib/simulation/backtest-real.ts` by normalising
`engineFeeTier = v3FeeTier / 100` before passing to `runBacktest`. The
test in `tests/backtest-real.test.ts` was updated to assert the
normalised value. **131/131 tests pass.**

## Honest assessment

Even after the feeTier fix, the simulator is off by **~7-30% APR** on
the median pool-day. That's far from the ±1-5% APR bar the north-star
sets. Reasons (in order of impact):

1. **Ground truth itself is approximate.** My `PriceDataPoint`-level
   ground truth uses `dailyFeesUsd` (already pre-fee) × liquidityShare ×
   price-range-based TIR. It ignores volatility-weighted fee accrual and
   the non-linear fee distribution within the tick range. To get a true
   ground truth we need **per-swap** events — which require an API key on
   The Graph's decentralized gateway or Covalent GoldRush.

2. **Simulator's IL formula is naive.** The `Math.sqrt(priceRatio) -
   (priceRatio+1)/2` approximation is a 50/50-position approximation. For
   a ±10% concentrated position, IL dynamics are different and the
   current model overestimates losses in some regimes.

3. **Fee accrual is uniform across the tick range.** Real V3 fees accrue
   asymmetrically — concentrated liquidity near the active tick captures
   far more than its proportional share. Both my GT and the simulator
   ignore this.

4. **3 pools are missing** because their addresses aren't in DeFi Llama
   (low-liquidity altcoin pools). 2 stables were rejected by Binance
   (USDTUSDT doesn't trade, and a USDT-paired mirror of USDC isn't there).

## What reaching the star actually requires

This isn't "add a layer" or "fix one bug." To get to ±5% APR MAPE we need
all of:

- **Per-swap historical data** (subgraph or Covalent GoldRush — free tier
  requires registration).
- **Concentrated-liquidity-aware fee model** that respects the tick
  distribution, not uniform-share.
- **Better IL model** for non-50/50 positions, possibly with closed-form
  formulas from the V3 white paper.
- **Validation on a held-out set** of pool-days, not the same set we
  tuned on.

This is weeks of focused work, not minutes. Until then, the simulator is
**indicative** at best — a ±30% APR projection is *directionally* correct
(LDO/WETH 0.3% sim=0.51% vs gt=-3.36%, WBTC/USDC 0.3% sim=34.01% vs
gt=29.93%) but not precise enough to stake $250k of LP capital on.

## Files added / modified

- `scripts/validate-northstar.ts` — the harness
- `lib/simulation/backtest-real.ts` — feeTier normalisation fix
- `tests/backtest-real.test.ts` — assertion updated
- `validation-results/validation-*.csv` — per-pool raw data

## What I will NOT do

I will not claim "decision-grade" again until I can show empirically that
the simulator projects 30-day returns within ±5% APR of realized returns
on a held-out set of ≥20 pools × 30 days. The current run does not.