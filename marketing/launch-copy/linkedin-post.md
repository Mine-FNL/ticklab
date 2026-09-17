# LinkedIn Post
**Audience:** fintech founders, DeFi protocol builders, engineering leaders, capital-markets quants
**One-line:** Engineering-rigor-first launch post for a free V3 LP simulator with empirical validation.

---

I spent the last shipping round doing something most LP tools skip: building a validation harness that measures the simulator's own accuracy against real ground-truth data.

The result is `univ3-strategy-lab` — an open-source Uniswap V3 concentrated-liquidity strategy simulator.

What "production-grade" looks like in this build:

- **131/131 unit tests** green, 4 Playwright E2E specs, TypeScript strict mode.
- **17 API routes** with an OpenAPI 3.1 spec at `/api/openapi.json` and Prometheus metrics at `/api/metrics`.
- **Standalone TypeScript SDK** at `packages/sdk/` for downstream builders.
- **V3 in-range simulator** with proper token0/token1 leg rebalancing, **V4 hooks discovery** for forward-looking signals, and a full risk module (VaR, CVaR, Sharpe, Sortino, Calmar, Ulcer, Burke).
- **Zero API keys.** Runs on DeFi Llama + Binance + public RPCs across Ethereum, Arbitrum, Base, Optimism, and Polygon.

The part I'm proudest of is the validation harness. `npm run validate:northstar` replays 18 real V3 pools against DeFi Llama per-pool daily fees and Binance OHLC, then prints sim vs realized 30-day cumulative return for each one. Latest run: **median absolute error 1.55 pp** (down from 7.91 pp — roughly a 6× improvement after fixing a 100× fee-tier basis-point bug and a cumulative-vs-annualized unit mismatch). 131 tests still green.

I also shipped the failures. The relative-error north-star metric is 0/15, three pools skip on DeFi Llama coverage gaps, and the V3 in-range simulator has a stable-base convention that misbehaves on non-stable pairs. All called out by name in `NORTH_STAR_REPORT.md`.

If you LP on V3 or build tooling on top of it, I'd value your look. The repo is here:

https://github.com/0xBingBong69/univ3-strategy-lab

What's your take — should an LP simulator's accuracy be reported as absolute error in percentage points, or is there a domain-specific metric that would be more useful for real capital deployment decisions?
