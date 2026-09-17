# Product Hunt Launch
**Audience:** Product Hunt hunters, maker community, fintech/DeFi early adopters
**One-line:** PH-ready assets, tagline, maker comment, and hunter outreach for `ticklab`.

---

## Tagline (60 chars max)

> Open-source Uniswap V3 LP simulator with empirical validation

(58 chars)

---

## Description (260 chars max)

> Free, open-source simulator for Uniswap V3 concentrated-liquidity strategies. V3 in-range + V4 hooks discovery, full risk module, portfolio aggregation, standalone TS SDK. Ships a reproducible validation harness — 1.55 pp median error vs DeFi Llama ground truth across 15 real pools. Zero API keys. 17 API routes, OpenAPI 3.1, Prometheus metrics.

(257 chars)

---

## First Comment (Maker, 150-300 chars)

> Hey — maker here. The thing I cared about most was honesty: shipping a validation harness (`npm run validate:northstar`) that measures the simulator's own accuracy against real DeFi Llama per-pool daily fees + Binance OHLC. Latest run: 1.55 pp median absolute error, down from 7.91 pp after a 100× fee-tier bug fix. Three pools skip on DeFi Llama coverage gaps; the relative-error north-star is 0/15 because it's the wrong metric for tiny-GT pools — all called out in NORTH_STAR_REPORT.md. Next up: per-swap data via Covalent/The Graph to close the remaining accuracy gaps.

(297 chars)

---

## Asset Checklist

Icons / images:
- [ ] **Logo** (1024×1024 PNG, transparent bg) — `wstETH/ETH` mark or LP-range glyph
- [ ] **Icon** (256×256 PNG) — for nav and PH gallery
- [ ] **Thumbnail** (240×240 PNG) — PH-required

Screenshots (1272×888 or 1440×900 PNG):
- [ ] **Landing / dashboard** — landing page with chain selector and top pools
- [ ] **Strategy Builder** — range slider + risk metrics panel
- [ ] **Backtest Results** — sim vs realized cumulative return with confidence bands
- [ ] **North-Star Report render** — terminal/CLI output of `validate:northstar`
- [ ] **API explorer** — OpenAPI 3.1 spec rendered at `/api/openapi.json`
- [ ] **Portfolio dashboard** — multi-position aggregation with correlation heatmap

Animated:
- [ ] **GIF — simulator flow**: pick pool → set range → run backtest → read confidence bands
- [ ] **GIF — validation harness**: terminal running `npm run validate:northstar` to printed report
- [ ] **Short demo video (≤ 90s)** for the PH gallery

Misc:
- [ ] First-comment hero image (1272×600)
- [ ] Topic tags: `DeFi`, `Open Source`, `Developer Tools`, `Crypto`, `Analytics`

---

## Suggested Hunter Outreach

Hunters who might take this on (defer to their preferences before contacting):

1. **Chris Messina** (@chrismessina) — prolific PH hunter, ships early on dev-tools and open-source infra. Why him: he's posted a high volume of well-received Show HN-equivalent launches and has good PH SEO.
2. **Bram Kanstein** (@bramk) — no-code + dev-tools specialist, regularly surfaces under-the-radar OSS launches. Why him: strong with developer-facing tools.
3. **Kevin William David** (@kevinwdavid) — large PH hunter, crypto-and-AI crossover. Why him: he hunts in the DeFi and tooling space frequently.
4. **Benny Hsu** (@bennyhsu) — indie hacker community. Why him: his audience matches the "I LP and want better tools" persona.
5. **Sairam Krishnan** — ex-Stripe, now at a16z crypto. Why him: ships early on crypto tooling and has the audience for "A16Z-grade engineering" framing.
6. **Arjun Sethi** (@arjunsethi) — crypto-native angel and PH hunter. Why him: actively hunts DeFi launches.
7. **Liam J. Kelly** — runs the "Maker Mag" newsletter, hunts indie OSS. Why him: amplifies builders, especially in infra.
8. **Jascha Kaykas-Wolff** — PH veteran hunter, broader tech audience. Why him: surfaces projects with honest metrics stories.
9. **Chris Wanstrath** — GitHub co-founder, occasionally surfaces PH launches. Why him: OSS credibility stamp is huge for a developer-tooling launch.
10. **Vikram Sreekanti** — PH power user in the dev-tools category. Why him: hits the same target persona (engineers who LP).

---

## Suggested Topics / Categories on PH

- Open Source
- Developer Tools
- Crypto
- Analytics
- Finance

---

## Suggested Launch Day (Tuesday–Thursday, 8:00–10:00 AM PT)

Target a weekday morning so most of the SF and NYC crypto crowd sees it during the workday. Have the maker comment posted within 60 seconds of going live — that's what PH rewards.
