# Tweet thread — "Why I built Ticklab"

**Target audience:** Crypto Twitter, DeFi researchers
**Voice:** Personal, candid, founder-voice. First-person where it adds texture.
**Tone:** Engineering confession, not marketing.

---

**(1/n)** I lost $30k on a Uniswap V3 LP strategy that a simulator said would make +41% APR.

The simulator didn't lie. It just didn't know it was wrong.

That gap — "the model said 41%, reality was 6%" — is what I'm trying to fix with Ticklab.

---

**(2/n)** Every LP simulator I evaluated — open-source, commercial, in-house — had the same disease.

They projected an APR. None of them checked their own work.

So I built a harness that pulls real DeFi Llama fees and Binance prices, replays every pool-day through the simulator, and prints the error.

`npm run validate:northstar` → 1.55 pp median error, 6× better than the baseline.

---

**(3/n)** The two fixes that got us from 7.91 pp → 1.55 pp were:

1. `feeShare = 0.01` → `feeShare = 0.001` (10× over-projection for retail LPs)
2. Stop comparing cumulative return to annualised APR. Compare cumulative to cumulative.

Neither is novel. Both were buried in the baseline. Both are now tested.

---

**(4/n)** The thing that made me want to ship this:

A model that publishes its error is a model you can trust when the error is small.

A model that hides its error is a model you can never trust.

I want every LP simulator to publish its error. Ticklab is the example.

---

**(5/n)** It's MIT licensed. Zero API keys. Runs on DeFi Llama + Binance + public RPCs.

```bash
git clone https://github.com/Mine-FNL/ticklab
cd ticklab && npm install
npm run validate:northstar
```

Anyone can run it. Same numbers. That's the whole pitch.

---

**(6/n)** V3 + V4 in one tool. 257 tests passing. TypeScript SDK at `@ticklab/sdk`. OpenAPI spec. Prometheus metrics. Docker. Vercel-deployable.

Production-grade on the engineering side. Honest on the measurement side.

If you LP V3 or V4, I'd take a star. If you spot a bug, open an issue — the harness will catch it.

github.com/Mine-FNL/ticklab

---

*Hashtags to append as appropriate:* `#Uniswap` `#V4` `#DeFi` `#LP` `#OpenSource`

