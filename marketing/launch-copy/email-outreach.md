# Email Outreach Templates
**Audience:** DeFi protocol founders + DeFi newsletter editors
**One-line:** Two short cold-email variants, each ≤ 200 words, tuned to the recipient's incentives.

---

## Variant A — DeFi Protocol Founder

**Subject:** Open-source V3 LP simulator with reproducible empirical validation

Hi [First name],

I built an open-source Uniswap V3 LP strategy simulator with something I think is unusual for the space: a validation harness that measures the simulator's own accuracy against real ground-truth data.

It's called `ticklab`. The validation script (`npm run validate:northstar`) pulls per-pool daily fees from DeFi Llama and price paths from Binance, replays 18 real V3 pools, and prints sim vs realized 30-day cumulative return for each one. Latest run on 15 of 18 pools (3 skip on DeFi Llama coverage): median absolute error **1.55 pp**, down from 7.91 pp in the prior round — a ~6× reduction after fixing a 100× fee-tier basis-point bug and a cumulative-vs-annualized unit mismatch in the comparison.

The engineering surface is what you'd expect from a16z-grade: 17 API routes, OpenAPI 3.1, Prometheus metrics, Playwright E2E, 131/131 unit tests, a standalone TypeScript SDK at packages/sdk/. TypeScript strict, zero API keys.

Honest gaps: the relative-error north-star metric (% within ±20% rel err) is 0/15 — wrong metric for tiny-GT pools, and the absolute-error one is the one to trust. All failures are named in `NORTH_STAR_REPORT.md`.

If [Protocol] has feedback on the methodology or wants to plug into the validation pipeline, I'd value a 15-minute conversation.

Repo: https://github.com/Mine-FNL/ticklab

Best,
[Your name]

(192 words)

---

## Variant B — DeFi Newsletter Editor

**Subject:** A V3 LP simulator that ships its own error metrics (story angle)

Hi [First name],

Most LP tools publish a projected APR and stop there. I built one that publishes its own error against real ground-truth data, and I think there's a story in the methodology.

`ticklab` is an open-source Uniswap V3 LP simulator. The validation harness (`npm run validate:northstar`) replays 18 real pools against DeFi Llama per-pool daily fees and Binance OHLC, then prints sim vs realized 30-day cumulative return for each. Latest run: **1.55 pp median absolute error** (down from 7.91 pp) — roughly a 6× improvement after two real bugs were found and fixed (a 100× fee-tier basis-point mistake and a cumulative-vs-annualized unit mismatch). The repo ships the failure list in `NORTH_STAR_REPORT.md` rather than hiding it.

Engineering surface: 17 API routes, OpenAPI 3.1, Prometheus metrics, Playwright E2E, 131/131 unit tests, standalone TS SDK, TypeScript strict, zero API keys. 15 of 18 pools validated; 3 skip on DeFi Llama coverage gaps for ENS/SUSHI/PEPE.

The angle I'd pitch: "An LP simulator that tells you when it's wrong" — a story about reproducibility and honest measurement in DeFi tooling.

Happy to send the full report or do a 15-minute walkthrough of the methodology.

Repo: https://github.com/Mine-FNL/ticklab

Best,
[Your name]

(199 words)

---

## Notes on Usage

- **Send from a personal address, not a no-reply.** Cold email reply rates roughly double with a real human behind the signature.
- **Personalize the opener.** A 1-sentence reference to their last piece of writing or product is worth more than any pitch tweak.
- **Don't attach the report.** Link to `NORTH_STAR_REPORT.md` in the repo; attached files trigger spam filters and lower reply rates.
- **Follow up once, after 4–5 business days.** One follow-up roughly doubles reply rates; two follow-ups halve them.
