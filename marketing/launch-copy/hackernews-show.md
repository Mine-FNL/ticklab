# Show HN: Hacker News
**Audience:** engineers, quant-leaning devs, technical founders
**One-line:** Honest empirical validation of a Uniswap V3 LP simulator against real DeFi Llama + Binance data, with a 6× error reduction and a reproducible harness anyone can rerun.

---

**Title (≤ 80 chars):**

> Show HN: Uniswap V3 LP simulator with reproducible empirical validation

---

**Body:**

`ticklab` is a Next.js 14 / TypeScript-strict simulator for Uniswap V3 concentrated-liquidity strategies. It runs entirely on free public endpoints — DeFi Llama for pool metrics, Binance daily OHLC for prices, public RPCs for on-chain state. No API keys, no paid tier, no mocked data.

What I think is interesting:

- **An honest validation harness.** Every projection can be replayed against real ground-truth P&L with `npm run validate:northstar`. It pulls per-pool daily fees from DeFi Llama and price paths from Binance, replays each pool-day, and compares simulated vs realized 30-day cumulative return. Numbers are reproducible end-to-end.
- **6× accuracy improvement.** After this round's fixes (corrected fee-tier basis-point math, apples-to-apples cumulative return comparison), the median absolute error dropped from 7.91 pp to **1.55 pp** on a 30-day window across 15 of 18 pools. Mean 3.31 pp, max 13.2 pp.
- **A16Z-grade engineering surface.** 17 API routes (including `/api/openapi.json` and Prometheus `/api/metrics`), 4 Playwright E2E specs, 131/131 unit tests green, a standalone TypeScript SDK at `packages/sdk/`, V3 in-range rebalancing and V4 hooks discovery.

**Honest caveat.** The north-star metric — % of pool-days within ±20% relative error — is currently **0/15**. The absolute-error metric is the one to trust, and it passes. The relative metric is dominated by pools with near-zero GT cumulative return, and the remaining gaps are gated on per-swap data (Covalent / The Graph) and DeFi Llama coverage for ENS/SUSHI/PEPE. Read `NORTH_STAR_REPORT.md` for the full picture.

Repo: https://github.com/Mine-FNL/ticklab

**Question for the community:** What's the right way to define "accuracy" for an LP simulator — absolute error in pp, relative error vs GT, or something domain-specific like a percentile of the realized-vs-projected fee distribution? I'd rather have a defensible metric than a flattering one.
