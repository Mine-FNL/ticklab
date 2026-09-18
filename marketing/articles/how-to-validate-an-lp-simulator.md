# How to validate an LP simulator

*A practical methodology for measuring whether your backtest is honest — with worked code, real data sources, and the failure modes we found.*

**Reading time:** 12 minutes · **For:** DeFi researchers, LP strategy designers, audit reviewers

---

## Why this matters

LP simulators are decision infrastructure. When a backtest says "this strategy will return 41% APR", an LP often deploys real capital on the basis of that number. If the number is wrong by 30 percentage points — and the simulator never checks its own work — the LP loses money.

The standard solution to "is this simulator accurate?" is **a validation harness**: a script that runs the simulator against ground-truth realized returns and reports the error. This article walks through what a good validation harness looks like, the failure modes we discovered while building one, and the specific code path you'd need to replicate it.

If you build or use LP simulators, this is the methodology that catches the worst class of errors before they reach a strategy decision.

---

## The minimum-viable validation harness

A validation harness needs five things:

1. **A list of pools to test.** Real pools, real fee structures, real liquidity depth. Skip pools with no fee history.
2. **A window.** 30 days is a reasonable default — long enough to capture a meaningful return cycle, short enough to keep the harness runtime tractable.
3. **Ground-truth data per (pool, day).** Per-pool daily fees from DeFi Llama. Daily price path per token from Binance (or CoinGecko if you have a key).
4. **The simulator under test.** Same range, same fee assumptions, same gas model the LP would have used.
5. **An error metric.** Median absolute error (in percentage points of cumulative return) is the most robust default.

Pseudocode:

```python
for pool in pools:
    fees = defillama.fetch_pool_fees(pool, start, end)
    prices = binance.fetch_ohlc(pool.tokens, start, end)
    for day in days:
        sim_return = simulator.run(pool, day, prices, fees)
        gt_return = realized_cumulative(pool, day, fees, prices)
        errors.append(abs(sim_return - gt_return))

print(f"median abs error: {median(errors):.2f} pp")
print(f"mean abs error:   {mean(errors):.2f} pp")
print(f"max abs error:    {max(errors):.2f} pp")
```

That's the whole framework. Everything below this is about choosing the right metric and avoiding the failure modes.

---

## Choosing the metric

The three common error metrics and what each one tells you:

**Median absolute error (pp)** — robust to outliers, easy to interpret. "Half the time, our simulator is within X pp of reality." Use this as your primary headline.

**Mean absolute error (pp)** — penalizes outliers equally. Useful as a secondary metric because it surfaces pools where the simulator is *consistently* wrong, not just sometimes wrong.

**Max absolute error (pp)** — worst case. Always report it, even though it's the most likely to be a single-pool edge case. If your max is 10× your median, you have a tail problem.

**Relative error (%)** — only meaningful per-swap. Avoid for cumulative-return comparisons because small ground-truth returns inflate the relative number. A 0.5 pp error on a 1% return is 50% relative — alarming-sounding but not actually informative.

If you're doing cumulative-return validation, **report absolute error in pp** as the primary metric and don't bother with relative.

---

## Failure modes we found while building Ticklab

### Failure 1: fee-share coefficient

`feeShare` is the multiplier that converts "pool fees collected" into "fees the LP captures." It's a function of LP deposit size and pool TVL.

The naive assumption: `feeShare = 0.01` (the LP captures 1% of pool fees). This is approximately correct for a $1M LP into a $100M pool.

For a $10k retail LP into the same pool, it's off by 10×. The simulator projects 10× the actual fee income. We found this in our baseline by accident — a single line changed median error from 7.91 pp to 1.55 pp.

**Fix:** calibrate fee-share against actual realized deposits, not against a guessed percentage. Or use a dynamic fee-share function of deposit size and pool TVL.

### Failure 2: apples-to-oranges comparison

Some simulators project an annualised APR but measure ground truth as 30-day cumulative return. The 12× mismatch alone produces a ~12 pp error in the median — even if the simulator is perfect.

**Fix:** compare same-axis on both sides. If the simulator reports APR, ground-truth must be annualised. If both report cumulative, that's fine too. The harness must compute ground truth on the same axis as the simulator's projection.

### Failure 3: no ground truth at all

This is the failure mode most simulators fall into: they never see realized returns, because their data layer is built on assumptions (constant fees, projected TVL, hypothetical price paths).

**Fix:** the harness's data layer must be different from the simulator's data layer. If they share data, you can't validate. Use DeFi Llama for ground truth (it's the realized-fee aggregator) and Binance for ground-truth prices.

### Failure 4: ignoring stable pairs

Stable-stable pairs (USDC/USDT, FRAX/USDC) have very low fee yields. Any absolute error in pp gets amplified in relative terms because the ground-truth return is close to zero.

If your harness reports stable-stable outliers, don't panic — just name them. The fix is either (a) exclude them from the headline metric with a documented reason, or (b) report them separately so the reader knows what's driving the mean.

### Failure 5: per-swap vs cumulative

Cumulative-return validation is a coarse metric. It tells you "did the LP make roughly the right amount of money" but not "did the simulator correctly model each individual swap."

If you want per-swap validation, you need per-swap data — and that's gated. Covalent GoldRush, The Graph decentralized network, or an archive node you run yourself.

Don't claim per-swap accuracy without per-swap data. If you don't have per-swap data, your metric is cumulative, and that's what you should publish.

---

## The data sources

The Ticklab harness uses three free, public data sources:

| Source | Used for | Free tier |
|---|---|---|
| **DeFi Llama** | Per-pool daily fees, TVL, volume | Generous public API, no key |
| **Binance** | Daily OHLC for any token | 1200 req/min, no key |
| **Public RPCs** | On-chain pool state when needed | Per-chain varies, no key |

There is no paid API in the harness. This is a constraint, not a limitation — it forces the harness to be reproducible by anyone. If your harness needs paid APIs, only the people who can pay can verify your claims.

If you have paid APIs, you can substitute them. The harness code is open source and the data layer is a thin interface (`lib/data/`).

---

## What "good" looks like

Empirical results from Ticklab's validation harness across 15 V3 pools × 30 days:

| Metric | Value | Notes |
|---|---|---|
| Median absolute error | 1.55 pp | Primary headline metric |
| Mean absolute error | 3.31 pp | Stable, not driven by outliers |
| Max absolute error | 13.16 pp | Stable-stable pair, named outlier |
| % within ±20% relative | 0 / 15 | Gated on per-swap data, not measured yet |

These numbers are reproducible. `git clone https://github.com/Mine-FNL/ticklab && npm run validate:northstar`.

If your LP simulator doesn't have a validation harness, you don't actually know whether it's accurate. Build one.

---

## What to put in the public harness

A validation harness that's not public is a validation harness nobody can verify. When you build one, publish:

1. The harness code (MIT or similar permissive license).
2. The exact pools, windows, and assumptions.
3. The full per-pool result table (not just the median).
4. The named limitations — outliers, gated metrics, data source assumptions.
5. The one-command reproduction (`npm run validate:something` or equivalent).

If your harness isn't reproducible by a stranger with a laptop and a fresh git clone, it's not a validation harness — it's an internal QA script.

---

## Closing

The cheapest way to lose money on a DeFi strategy is to trust a simulator that doesn't validate itself. The cheapest way to *gain* trust is to publish the harness that does.

Two fixes got us from 7.91 pp to 1.55 pp on Ticklab's baseline. Both were one-line. Both were buried in plain sight. Neither would have been found without a harness.

Build one. Publish it. Name the limitations.

The LP who reads your simulator's README will thank you.

---

*Author: Ticklab contributors · Published September 2026 · github.com/Mine-FNL/ticklab*

