# Why honest measurement matters in DeFi infrastructure

*A short opinion piece on the gap between projection and reality — and what it costs when infrastructure lies about itself.*

**Reading time:** 5 minutes · **For:** DeFi users, protocol designers, infrastructure investors

---

## The pattern

You pick a Uniswap V3 LP strategy. The simulator says 41% APR. You deposit. Three months later you've made 6%.

The simulator wasn't lying. It just never knew it was wrong.

This is the most common failure mode in DeFi infrastructure today, and it's not specific to any project. Every LP simulator we've examined — open-source, commercial, in-house — has this property: it projects returns without checking whether its projections match reality.

The cost is borne by LPs who make capital allocation decisions on numbers that turned out to be 30 percentage points off.

---

## Why infrastructure lies about itself

Three structural reasons:

**1. The simulator's data layer and the validation layer are the same layer.**

Most LP simulators project returns from the same data they would use to validate. If the data is wrong in a consistent direction (e.g. fees always over-projected), the simulator will report that wrong number as its projection, and there's nothing to compare against. There's no "this is what the simulator said" vs "this is what actually happened" because the simulator never sees "what actually happened."

**2. Validating yourself is hard.**

To validate a simulator you need:
- A separate data source for ground truth (DeFi Llama, Covalent, on-chain archive)
- A methodology for what counts as "the right answer" (cumulative return? per-swap P&L? annualised APR?)
- A pipeline that runs the simulator and the comparison reproducibly
- The honesty to publish the result, including when it's bad

Most teams can build the first three. The fourth is rare.

**3. There's no incentive to be honest.**

A simulator that says "I'm 30 pp off" is a simulator users avoid. A simulator that says "I'm 41% accurate" is a simulator users trust. The market rewards overconfidence.

---

## The cost

The cost compounds. Consider:

- An LP who deploys $250k on a strategy the simulator projected at +41% APR.
- Realized return: +6%. Loss vs projection: $87k.
- The LP doesn't know this happened. They think they just got unlucky with the market.
- They re-run the simulator. The simulator still says +41% (under different market conditions). They deploy again.
- The pattern repeats. The LP concludes "DeFi LP is a bad idea" and exits.

The LP didn't exit DeFi because LP is a bad idea. They exited because the simulator was consistently lying to them and they had no way to detect it.

Multiply by every LP using every LP simulator. The opportunity cost is enormous.

---

## What honest infrastructure looks like

Honest measurement has three properties:

**1. It publishes its own error.**

Every claim the infrastructure makes is accompanied by the error margin of that claim. "Median absolute error: 1.55 pp" is a sentence you can verify. "Best-in-class projections" is marketing.

**2. The error is reproducible.**

Not "trust us, we tested it." Anyone with a laptop and a fresh git clone can run the same validation and get the same number. The harness is open source. The data is free. The methodology is documented.

**3. The limitations are named.**

Stable-stable pairs have a 13 pp outlier — named, not hidden. Per-swap accuracy is gated on per-swap data — named, not hidden. The simulator doesn't generalize to V4 hooks — named, not hidden.

A team that names its limitations is a team you can trust about the rest.

---

## What we built

Ticklab is an open-source LP simulator and validation harness for Uniswap V3 and V4. Its distinguishing property is the validation harness — a single command (`npm run validate:northstar`) that pulls real DeFi Llama fees and Binance prices, replays every pool-day through the simulator, and prints the error per pool.

Current result: median absolute error of 1.55 percentage points across 15 of 18 V3 pools over a 30-day window. 6× improvement over the baseline. Reproducible by any reader with one command.

The 6× improvement came from two one-line fixes. Both were buried in the baseline. Neither would have been found without the harness.

The harness is MIT-licensed. The data sources are free. The full per-pool result table is published alongside the headline number, including the outlier (FRAX/USDC, 13.16 pp) and the gated metric (per-swap P&L, 0/15 within ±20% relative error, waiting on per-swap data).

---

## What we're asking for

If you're building DeFi infrastructure — a simulator, a yield aggregator, a vault strategy picker, a backtesting engine — build a validation harness. Make it reproducible. Publish the error margin. Name the limitations.

The LP who uses your tool will make a better decision than the LP who uses a tool that doesn't tell them when it's wrong.

That's the whole pitch.

---

*Author: Ticklab contributors · Published September 2026 · github.com/Mine-FNL/ticklab*

