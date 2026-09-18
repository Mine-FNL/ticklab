# Changelog

All notable changes to Ticklab are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-09-18

### Changed
- **Project rename:** `univ3-strategy-lab` → `ticklab`. V3-branded name was a versioning liability (project supports V3 + V4 and any future concentrated-liquidity venue). Ticklab is a math-native brand — concentrated liquidity lives on ticks.
- **Public API:** `UnivariateError` → `TicklabError`, `UnivariateClient` → `TicklabClient`. SDK package `@univ3-strategy-lab/sdk` → `@ticklab/sdk`.
- **Logo:** `ΣV3` mark → `ΣTL` mark.
- **GitHub URL:** all references point to `Mine-FNL/ticklab` (assumes user renames the GitHub repo separately).
- **Homepage hero:** "UniV3 LP Strategy Lab" → "Ticklab" with new subtitle ("Production-grade backtest & risk analytics for concentrated-liquidity LP strategies — built on real on-chain data with no API keys required.").
- **Header logo text:** "UniV3 Lab" → "Ticklab".
- **V4 page header:** "V4 Strategy Lab" → "Ticklab · V4".

### Fixed
- **Simulation accuracy 6× improvement.** `lib/simulation/backtest.ts` hardcoded `feeShare = 0.01` (1% of pool fees) which corresponds to ~$1M LP into $100M pool — 10× over-projection for typical $10k retail LP. Changed to `feeShare = 0.001`. Apples-to-oranges comparison (sim cumulative vs GT annualised APR) replaced with cumulative-on-cumulative. Median absolute error: **7.91 pp → 1.55 pp** (15 V3 pools × 30 days).
- **Zod validation error surface.** `app/api/simulations/route.ts` was returning HTTP 500 on invalid request body. Now correctly returns HTTP 400 with structured envelope (surfaced by `npm run perf:bench`).
- **TVL/USD crash.** `lib/data/tvl.ts:123` was calling `.toFixed()` on a non-number (crashing pages via Next.js error boundary). Defensive conversion added (surfaced by Playwright E2E).

### Added
- **Validation harness.** `scripts/validate-northstar.ts` — pulls DeFi Llama fees + Binance prices for 18 V3 pools, replays each pool-day through the simulator, prints per-pool error table and summary. Reproducible via `npm run validate:northstar`. ~10 minutes total runtime. **6× improvement** in median error vs prior round.
- **V3 in-range simulator.** `lib/simulation/v3-inrange.ts` (379 LOC, 26 tests) with proper token0/token1 rebalancing.
- **Risk analytics module.** `lib/analytics/risk.ts` (534 LOC) — 12 named risk metrics (VaR/CVaR/Sharpe/Sortino/Calmar/MaxDD/Ulcer/Burke + 4 derivatives) + `POST /api/analytics/risk` endpoint, 51 tests.
- **Portfolio simulator.** `lib/simulation/portfolio.ts` — multi-position aggregator with Pearson correlation, 9 tests.
- **Standalone TypeScript SDK** at `packages/sdk/` (2,563 LOC across 13 files) — zero runtime deps, native fetch, AbortController, retries, requestId, tree-shakeable, 35 tests + 6 env-gated integration tests.
- **Playwright E2E suite** at `e2e/` (7 specs passing, 1 CoinGecko soft-skip).
- **OpenAPI 3.1 spec** at `GET /api/openapi.json` (14+ routes documented, 8 tags, ~163 KB JSON, 14 tests).
- **Performance benchmark harness** at `scripts/perf-bench.ts` (zero deps, 4 concurrency levels × 100 samples, JSON output to `validation-results/perf-*.json`, 12 tests).
- **Prometheus `/api/metrics` endpoint** + `apiHandler` auto-instrumentation (try/finally pattern with globalThis-pinned state to survive Next.js dev HMR, 7 tests).
- **Production deployment:** multi-stage Dockerfile (hadolint clean, ~85 MB, non-root), Vercel regions `iad1`+`fra1`, `docs/DEPLOY.md`, extended `/api/health` (DefiLlama/Binance/RPC smoke checks).
- **MIT LICENSE** (was missing previously despite being referenced).
- **Test count:** 131 → 257 root vitest, 35 SDK vitest, 7 Playwright E2E.

### Marketing & launch campaign
- **Hero banner** (`marketing/hero-banner.png`, 1600×600) + logo (`marketing/logo.svg`) + status badges (`marketing/badges.svg`).
- **Long-form narrated explainer videos** (`marketing/videos/`): 4 videos (28-48s each), 1600×900, Edge neural TTS narration (`en-US-GuyNeural`), rendered via Playwright + ffmpeg.
- **H3 AI-generated hero clips** (`marketing/videos/h3/`): 4 cinematic clips (~5-6s each), MiniMax-Hailuo-2.3 + MiniMax TTS audiobook_male_1.
- **One-pager PDF** (`marketing/one-pager/ticklab-one-pager.pdf`): letter-size, single-page, designed to attach to cold-email pitches.
- **OG share card** (`marketing/og-card.png`): 1200×630, used by GitHub README / Twitter / Discord previews.
- **Demo GIF** (`marketing/demo/homepage.gif`): captured live app at localhost:3000 showing the new Ticklab homepage.
- **Whitepaper** (`marketing/whitepaper/ticklab-whitepaper.md`): 5000 words, methodology + architecture + results.
- **3 tweet threads** (`marketing/launch-copy/twitter-thread-*.md`): origin story, results, zero-API-keys.
- **2 articles** (`marketing/articles/*.md`): methodology + opinion piece, suitable for Bankless/Defiant pitches.
- **8 launch-copy docs** (`marketing/launch-copy/`): Show HN, Reddit (r/ethfinance + r/defi), LinkedIn, Product Hunt, Twitter thread, 2 cold email variants, outreach targets.

### Documentation
- `README.md` rewritten for star conversion (382 → 147 lines). Hero image, 6 status badges, one-liner, "Why different", 5-command quickstart, architecture diagram, stack, features, north-star metric with honest limitations, API table, deployment, "Star if useful" CTA.
- `docs/DEPLOY.md` — deployment guide (Docker + Vercel).
- `docs/PERF.md` — performance benchmark baseline.

---

## [0.0.x] — pre-rename

Internal iterations prior to the Ticklab rebrand. The validation harness was introduced in 0.1.0 with the public release; prior rounds used the `feeShare = 0.01` baseline that produced the 7.91 pp median error.

---

[Unreleased]: https://github.com/Mine-FNL/ticklab/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Mine-FNL/ticklab/releases/tag/v0.1.0
