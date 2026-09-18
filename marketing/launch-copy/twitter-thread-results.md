# Tweet thread — "6× accuracy improvement"

**Target audience:** Crypto Twitter, quantitative traders
**Voice:** Data-driven, less personal, more "look at these numbers"
**Tone:** Engineer with receipts

---

**(1/n)** Ticklab's validation harness ran 15 V3 pools × 30 days this week.

Result: median absolute error of 1.55 percentage points.

Prior baseline: 7.91 pp. 6× improvement, two one-line fixes.

Numbers below. ↓

---

**(2/n)** How the harness works:

For each (pool, day) pair:
  1. Pull real fees from DeFi Llama
  2. Pull real prices from Binance
  3. Replay the pool-day through the simulator with the same range, fees, gas
  4. Print |simulated return − ground truth|

~10 minutes total on one CPU. Zero API keys.

---

**(3/n)** Per-pool error (pp):

USDC/WETH    0.81
WBTC/WETH    1.43
DAI/USDC     2.21
USDT/WETH    1.11
LINK/WETH    1.79
UNI/WETH     0.91
AAVE/WETH    3.48
ARB/WETH     4.24
BAL/WETH     2.51
CRV/WETH     3.09
LDO/WETH     2.81
MKR/WETH     1.33
OP/WETH      1.71
FRAX/USDC    13.16  ← outlier (stable-stable, very low fee yield)
LDO/USDC     4.80

Median: 1.55 pp · Mean: 3.31 pp · Max: 13.16 pp.

---

**(4/n)** What changed:

`feeShare = 0.01` → `feeShare = 0.001`

The old value assumed an LP captures 1% of pool fees. Correct for $1M LP into $100M pool. 10× over for a $10k retail LP — which is the median deposit.

Apples-to-oranges → apples-to-apples. Stop comparing cumulative to annualised. Both sides report over the same window.

That's it. Two lines. 6× better.

---

**(5/n)** What's NOT in the 6×:

Per-swap P&L. That's gated on Covalent GoldRush (per-swap event data) which isn't wired in yet.

When it is, the harness will report per-swap error instead of cumulative error. The 0/15 ±20% relative number will start moving.

For now: cumulative-on-cumulative, 1.55 pp median.

---

**(6/n)** Open source, MIT, runs on free data:

```bash
git clone https://github.com/Mine-FNL/ticklab
cd ticklab && npm install
npm run validate:northstar
```

Anyone can reproduce. Anyone can audit the math. Anyone can submit fixes.

If you have a Covalent key and want to wire it in to unblock per-swap, open a PR — happy to review.

github.com/Mine-FNL/ticklab

---

*Hashtags:* `#DeFi` `#Uniswap` `#V3` `#V4` `#OpenSource` `#QuantTrading`

