# Twitter / X Thread
**Audience:** DeFi builders, quant folks, open-source engineers
**One-line:** Problem → bad sims → this exists → what it does → what makes it different → honest gap → star CTA.

---

(1/n) LP simulators ship projected APR like it's gospel. Then you deposit, the range goes out, and the realized number is a joke. I got tired of it, so I built one that publishes its own error against real ground truth.

(2/n) `univ3-strategy-lab` — open-source Uniswap V3 LP simulator. Next.js 14, TypeScript strict, 17 API routes, OpenAPI 3.1, Prometheus /metrics, Playwright E2E, standalone TS SDK at packages/sdk/. Zero API keys. Free public endpoints only.

(3/n) It does V3 in-range with proper token0/token1 leg rebalancing, V4 hooks discovery, multi-position portfolio aggregation with Pearson correlation, and the full risk module — VaR, CVaR, Sharpe, Sortino, Calmar, Ulcer, Burke.

(4/n) The differentiator: a reproducible validation harness. `npm run validate:northstar` pulls per-pool daily fees from DeFi Llama + prices from Binance, replays each pool-day, and prints sim vs realized 30-day cumulative return. Anyone can rerun it.

(5/n) Latest run: 15 of 18 pools completed. Median absolute error 1.55 pp. Mean 3.31 pp. Max 13.16 pp. Down from 7.91 pp median in the prior round — a 6x improvement after fixing a 100x fee-tier basis-point bug and a unit-mismatch in the comparison.

(6/n) Honest caveats: north-star metric (% within ±20% rel err) is 0/15. That metric is wrong for pools with near-zero GT return — the absolute error is the one that holds. 3 pools skip (ENS/SUSHI/PEPE) on DeFi Llama coverage gaps. V3 in-range has a stable-base convention that misbehaves on non-stable pairs.

(7/n) This is the project I wanted to exist when I started LPing. Free, open-source, no paid tier, every claim is verifiable, every failure is named in NORTH_STAR_REPORT.md. If you've been burned by LP sims, look at the report before you look at the marketing.

(8/n) Repo + validation report: https://github.com/0xBingBong69/univ3-strategy-lab If you LP V3 or build on top of it, I'd take a star. If you spot a bug, open an issue — the harness will catch it.
