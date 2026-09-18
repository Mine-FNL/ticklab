# Tweet thread — "Zero API keys"

**Target audience:** Crypto Twitter, open-source advocates, journalists covering DeFi infra
**Voice:** Slightly provocative, "you don't need what you think you need"
**Tone:** Direct, slightly contrarian

---

**(1/n)** Most DeFi simulators make you sign up for 3 different paid APIs before you can run them.

DeFi Llama — paid tier for historical data.
CoinGecko Pro — paid tier for OHLC.
Alchemy / Infura — paid tier for RPC.
The Graph — paid tier for subgraphs.

Ticklab uses zero of those.

---

**(2/n)** How is that possible?

DeFi Llama's free public API gives you per-pool daily fees, TVL, volume. Enough to validate a simulator against ground truth. No signup, no key.

Binance's public REST API gives you daily OHLC for any token. 1200 req/min, no key.

Public RPCs (llamarpc, arbitrum.io, base.org, etc.) give you on-chain reads. Slower than paid but functional for non-realtime use.

---

**(3/n)** Why does this matter?

If your simulator needs paid APIs to run, the validation harness needs them too. If the harness needs paid APIs, only the people who can pay can verify your claims.

A model you can't independently verify is a model you can't trust.

Ticklab's whole point is that the metric is reproducible by anyone with a laptop.

---

**(4/n)** The trade-off:

Public APIs are slower and rate-limited. DeFi Llama's free tier gives you 18 V3 pools × 30 days in ~30 seconds. Binance gives you a year's daily data in ~10 seconds. Public RPCs are slow for state-heavy queries but fine for read-only batch fetches.

If you need real-time or high-throughput, you still pay. Ticklab is for backtesting, validation, and design — not for live trading bots.

---

**(5/n)** What this changes:

When you read a Ticklab error metric (1.55 pp median, etc.), you can:
  - Run the harness yourself
  - Audit the data sources (DeFi Llama, Binance, public RPCs)
  - Replace any of them with a paid alternative if you want
  - Compare your numbers to mine

No platform lock-in. No signup. No key.

The only thing you need is a terminal and `git clone`.

---

**(6/n)** The architecture:

```
scripts/validate-northstar.ts
  → DeFi Llama   (no auth)
  → Binance      (no auth)
  → Public RPC   (no auth)
  → Ticklab simulator (local)
  → per-pool error CSV + summary
```

6 files of code. 257 tests. MIT.

github.com/Mine-FNL/ticklab

---

*Hashtags:* `#OpenSource` `#DeFi` `#DeFiLlama` `#Binance` `#Uniswap` `#DataSovereignty`

