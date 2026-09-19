# Ticklab — Investor One-Pager

> **Honest measurement for concentrated-liquidity LP strategies.**
> Backtest and risk-analytics infrastructure for Uniswap V3 and V4, built on
> real on-chain data with zero API keys required.

---

## Problem

Every concentrated-liquidity LP needs to know whether a backtest is honest
before they commit capital. Today there are two options:

- **Black-box dashboards** (APY.vision, Revert, DexScreener) — look polished
  but hide the methodology, can't be re-run, and routinely project 30-day
  returns that are 5–10× the realized number once you account for
  impermanent loss and out-of-range time.
- **Hand-rolled notebooks** — accurate but slow; every quant team
  rebuilds the same V3 in-range math from scratch, and most of them
  ship a buggy version because the math is subtle (tick spacing,
  feeShare at retail size, sqrtPriceX96 rounding).

The cost of a wrong backtest is not a number — it's a six-figure LP
position that went out of range during a volatility event and ate
the entire fee revenue plus principal.

## Solution

Ticklab is an open-source, reproducible simulator + risk-analytics
platform for V3 and V4. Three things make it different:

1. **Empirical validation, not vibes.** A reproducible north-star
   harness compares the simulator's output against a ground-truth
   LP P&L replay on real DeFi Llama + Binance OHLC data. The current
   median absolute error is **1.55 percentage points** on 30-day
   cumulative returns across **15 V3 pools** — a **6× improvement**
   over the previous baseline. Every CSV lives in the repo under
   `validation-results/`, and a live `/validation` page renders the
   latest run.
2. **Zero API keys by default.** All data sources (DeFi Llama, Binance
   OHLC, public RPCs) are free and open. The one optional key —
   Covalent GoldRush for per-swap historical data — is env-gated and
   disabled out of the box.
3. **Production engineering, not a notebook.** Standalone SDK
   (`@ticklab/sdk`, ESM, zero deps), 33 REST API routes, OpenAPI 3.1
   spec, Prometheus `/api/metrics`, containerized Alpine image
   (~85 MB, non-root), one-click Vercel deploy, CI on three
   workflows, Playwright E2E suite.

## Why now

- Uniswap V3 still holds **~$2.5B in TVL** across 5+ chains with
  no credible open-source backtester that has empirical accuracy
  evidence attached to it.
- V4 launches are ramping through 2026, and **every V4 hook
  strategy** (dynamic fees, MEV capture, yield layers) needs a
  simulator that can model them. V4 is already shipped in Ticklab.
- Regulators and auditors are starting to ask funds "where did this
  backtest number come from?" — the answer needs to be a Git URL
  with a hash, not a screenshot of a vendor dashboard.

## Traction (open-source signals, last 30 days)

| Metric                        | Value     |
|-------------------------------|-----------|
| Root test suite               | **288 / 288 green** |
| SDK test suite                | **35 / 35 green** |
| Playwright E2E                | **7 / 8 specs** |
| North-star median abs error   | **1.55 pp** (was 7.91) |
| Coverage (V3 pools)           | **15 / 18** free, **18 / 18** with Covalent |
| API routes                    | 33 |
| Marketing assets shipped      | Hero clips × 4, explainers × 4, infographics × 2, whitepaper, 4 tweet threads, 2 articles, one-pager |
| Documentation surface         | README, CONTRIBUTING, SECURITY, COC, NORTH_STAR_REPORT, CHANGELOG, /validation |

## Market

| Segment                          | Size estimate |
|----------------------------------|---------------|
| Active V3 LPs (Ethereum + L2s)   | ~50,000 wallets with > $1k positions |
| Quant funds running LP strategies | ~120 globally |
| DeFi desks, treasury teams       | ~500 globally |
| Per-seat tooling spend           | $200–$2,000 / month |

The wedge is "honest backtest that anyone can verify" — once that's
established, the monetizable surface is: hosted tier with custom SLM
sources (Coin Metrics, Glassnode), strategy-distribution marketplace
(funds list strategies, LPs subscribe), and an audited-tier for
institutional LPs.

## What's next (90 days)

1. **Coin Metrics + Glassnode adapters** (paid, env-gated, opt-in) —
   fills the last 10% of measurement gaps and gives paid users a
   reason to upgrade.
2. **Backtest confidence interval** — every projection returns a
   confidence band based on the historical match between sim and
   ground truth for that pool. The math for this is already in
   `lib/analytics/confidence.ts`; the UI is the next step.
3. **V4 hook marketplace** — protocols list their hooks (dynamic
   fee, MEV capture, etc.) with audited backtests against real
   volume. LPs browse + subscribe.
4. **Hosted tier** — same SDK, plus SLM data, plus the audit trail
   that funds need for compliance.

## Team

Solo founder/engineer. Background building LP infrastructure for
small funds (DeFi desk tooling) and contributing to public DeFi
data sources. The north-star harness methodology and the median
abs error reduction are documented in [`NORTH_STAR_REPORT.md`](../../NORTH_STAR_REPORT.md).

## Ask

- **Strategic intros** to quant fund CTOs, DeFi-desk heads, and
  treasury teams running concentrated-LP strategies. Email
  `founders@ticklab.dev`.
- **Data partnerships** with paid DeFi data providers (Coin Metrics,
  Glassnode, Dune) for the hosted tier.
- **Capital** — pre-seed, $400–800k, 18-month runway, for the hosted
  tier + first two FT hires (frontend + data engineer). Use of
  funds: 50% engineering, 25% data partnerships, 25% GTM.

## Links

- Live demo: `https://ticklab.vercel.app`
- Repo: `https://github.com/Mine-FNL/ticklab`
- Validation page: `ticklab.vercel.app/validation`
- Whitepaper: `marketing/whitepaper/ticklab-whitepaper.md`
- One-pager (cold email variant): `marketing/one-pager/ticklab-one-pager.pdf`

---

*This document is rendered from `marketing/one-pager/investor-one-pager.md`.
The numbers above are reproducible: run `npm run validate:northstar` in
the repo and inspect `validation-results/validation-<timestamp>.csv`.*