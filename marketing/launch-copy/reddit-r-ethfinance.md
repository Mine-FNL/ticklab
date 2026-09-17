# Reddit r/ethfinance
**Audience:** ETH-native DeFi users, LPs, capital-efficiency obsessives
**One-line:** A free, open-source V3 LP simulator that ships with empirical validation against real data — and honest numbers about where it falls short.

---

**Title (≤ 300 chars):**

> Built an open-source Uniswap V3 LP strategy simulator with a reproducible validation harness against real DeFi Llama + Binance data — 1.55 pp median error, 131/131 tests, zero API keys

---

**Body:**

Hey r/ethfinance — long-time lurker, first-time poster on this side. I've been working on `ticklab`, a simulator for concentrated-liquidity strategies on Uniswap V3 (and now V4 hooks discovery). It's free, runs on public endpoints (DeFi Llama + Binance + public RPCs), and the code is open.

What makes it different from the usual dashboards:

**1. Honest measurement.** Most LP tools give you a single projected APR and call it a day. This one ships a validation harness (`npm run validate:northstar`) that replays 15 real pools against DeFi Llama per-pool daily fees and Binance OHLC, then compares sim vs realized 30-day cumulative return. You can rerun it yourself and watch the numbers move. After two engineering fixes this round, median absolute error is **1.55 pp** (down from 7.91 pp before — roughly a 6× improvement). Mean 3.31 pp, max 13.16 pp.

**2. Capital efficiency is the whole point.** It's built for the people who actually care about range placement, IL decomposition, in-range rebalancing (token0/token1 leg-aware), and risk metrics — VaR, CVaR, Sharpe, Sortino, Calmar, Ulcer, Burke, plus multi-position portfolio aggregation with Pearson correlation across positions.

**3. No paid tier.** 17 API routes, OpenAPI 3.1 spec at `/api/openapi.json`, Prometheus metrics, 4 Playwright E2E specs, standalone TypeScript SDK at `packages/sdk/`. TypeScript strict, 131/131 tests.

**Where I'm honest with you:** the relative-error north-star (% within ±20% rel err) is 0/15 — that's the wrong metric for pools with near-zero ground-truth return. The absolute error is the one that matters and it's tight. Three pools (ENS/SUSHI/PEPE) skip due to DeFi Llama coverage gaps.

If you LP WETH/USDC, WBTC/ETH, stables, or any of the mid-cap pairs, give it a spin. The repo and a full transparent report are here:

https://github.com/Mine-FNL/ticklab

Would love feedback from anyone who's been burned by LP simulator projections that don't survive contact with reality.
