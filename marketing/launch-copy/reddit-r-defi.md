# Reddit r/defi
**Audience:** broader DeFi community — LPs, builders, researchers, curious observers
**One-line:** The only LP simulator I know of that publishes its empirical error against real ground-truth data — and ships the harness to reproduce it.

---

**Title (≤ 300 chars):**

> Open-source Uniswap V3 LP simulator with an honest validation harness: 1.55 pp median abs error vs DeFi Llama ground truth, 0 API keys, full reproducible benchmark

---

**Body:**

Most LP tools — Apwine, Beefy, the various yield dashboards — publish a projected APR and stop there. `univ3-strategy-lab` is the project I want to use, so I built the thing I wanted: a V3 strategy simulator that ships **its own error measurement** against real ground-truth data, end-to-end reproducible.

What's in the box:

- **V3 in-range simulator** with proper token0/token1 leg rebalancing (no more "stable-base" fakery for non-stable pairs — that's flagged as an honest limitation).
- **V4 hooks discovery** for early signals on the new pool architecture.
- **Portfolio simulator** — multi-position aggregation, Pearson correlation across positions, full risk module (VaR, CVaR, Sharpe, Sortino, Calmar, Ulcer, Burke).
- **Pre-deposit checklist** with a 10-rule severity ladder.
- **Live monitoring** — import a wallet position, get real-time analytics.
- **17 API routes**, OpenAPI 3.1 at `/api/openapi.json`, Prometheus `/api/metrics`, standalone TS SDK at `packages/sdk/`.

**The validation harness** is the differentiator. It's not a one-time claim — it's a script. `npm run validate:northstar` pulls per-pool daily fees from DeFi Llama and prices from Binance, replays each pool-day, and prints sim vs realized 30-day cumulative return. Latest run, 15 of 18 pools completed (3 skip on DeFi Llama coverage gaps for ENS/SUSHI/PEPE). Median absolute error: **1.55 pp**. Mean: 3.31 pp. Max: 13.16 pp. A 6× reduction from the prior round's 7.91 pp median after two real bugs got fixed (a 100× fee-tier basis-point mistake and an apples-to-oranges cumulative-vs-annualized comparison).

**Where I'm honest:** the relative-error metric (% within ±20% rel err) is 0/15 — it's the wrong metric for pools with near-zero ground-truth return, and the remaining gaps need per-swap data via Covalent / The Graph to close. The validation report (`NORTH_STAR_REPORT.md`) is in the repo, with the failures called out by name.

Free, open-source, no API keys, no paid tier. Five chains supported: Ethereum, Arbitrum, Base, Optimism, Polygon.

Repo: https://github.com/0xBingBong69/univ3-strategy-lab

If you've ever looked at an LP simulator's "projected APR" and wondered how anyone could ship that with a straight face — this is what I'm trying to do differently.
