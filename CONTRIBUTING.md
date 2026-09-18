# Contributing to Ticklab

Thanks for your interest in Ticklab. This guide covers how to set up a
local development environment, the engineering standards we hold
contributions to, and how to file a clean pull request.

## Code of conduct

Be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
Harassment of any kind will not be tolerated.

## Project overview

Ticklab is a Uniswap V3 / V4 concentrated-liquidity simulator with three
moving parts:

| Layer | Path | Purpose |
|-------|------|---------|
| Math engine | `lib/simulation/`, `lib/analytics/` | Pure functions — V3 in-range math, portfolio composition, risk metrics. Zero I/O. |
| Data adapters | `lib/data/` | Free public sources (DeFi Llama, Binance OHLC, public RPCs) + optional paid (Covalent GoldRush). |
| Web surface | `app/`, `components/`, `packages/sdk/` | Next.js app, SDK package, 33 API routes, OpenAPI 3.1 spec. |

The north-star metric is **median absolute error between the simulator
and a ground-truth OHLC + daily-fee LP P&L replay across a fixed 30-day
window**. Current value: **1.55 pp** on 15 V3 pools. See
[`NORTH_STAR_REPORT.md`](./NORTH_STAR_REPORT.md) for the full breakdown.

## Local setup

Requirements: **Node 20+** and **pnpm 9+** (npm works too, but pnpm is
what CI uses).

```bash
git clone https://github.com/Mine-FNL/ticklab.git
cd ticklab
pnpm install
pnpm dev          # http://localhost:3000
```

Verify your install with the test suite — it should be green on first run:

```bash
pnpm test                # vitest: 279+ tests
pnpm typecheck           # tsc --noEmit
pnpm --filter @ticklab/sdk test   # SDK: 35 tests
```

Playwright E2E is optional and slow — only run it before submitting UI
changes:

```bash
pnpm exec playwright install --with-deps chromium
pnpm test:e2e            # 7 specs
```

## Engineering standards

We hold every contribution to the same standards we ship with. PRs that
skip these will be sent back for revision:

### 1. Real data, no mocks

The simulator and validation harness MUST run against real on-chain data.
If you need a new external source, add it to `lib/data/` and wire it
through the harness — don't stub it. Unit tests may use `vi.fn()` for
fetch mocks, but the production code paths never fall back to synthetic
data.

### 2. TypeScript strict mode

`tsconfig.json` ships with `strict: true`. No `any`, no `@ts-ignore`,
no `// eslint-disable-next-line` without a one-line comment explaining
why. Use `zod` to validate anything that crosses an I/O boundary.

### 3. Test what you change

- Bug fix → add a failing test that reproduces the bug, then fix it.
- New metric / module → cover the happy path + edge cases (empty input,
  single element, all zeros, monotonic series, NaN guard). The existing
  `lib/analytics/risk.ts` test file is the canonical example of the
  shape we want.
- Data adapter → mock `fetch` (see `tests/covalent.test.ts`) and assert
  URL building, pagination, schema validation, error propagation.

### 4. Validation harness must stay green

If your change touches the simulation engine, data adapters, or risk
math, re-run the north-star harness locally and confirm the median
absolute error stays within 2 pp of the last published number:

```bash
pnpm validate:northstar
```

If the metric regresses, update `NORTH_STAR_REPORT.md` in the same PR
with the new number, the regression explanation, and the path to
recovery. A regressed metric with a transparent write-up is **better
than** a hidden regression that ships green.

### 5. No API keys in code paths

Ticklab's primary value prop is "no API keys required". The one
exception is the **Covalent GoldRush overlay**, which is explicitly
opt-in via the `COVALENT_API_KEY` env var and is disabled by default.
If you add a new paid source, follow the same pattern:
`isXEnabled()` probe + clear error message + zero-config fallback.

### 6. Outward-facing copy must not name the tools used to build it

README, CHANGELOG, marketing assets, and the live `/validation` page
must not reference the specific AI tools, image/video generators, or
TTS services used to produce them. Internal script docstrings and
code comments are fine.

## Project layout

```
.
├── app/                      # Next.js 14 app router
│   ├── (pages)/              # Route group — all user-facing pages
│   │   ├── page.tsx          # /
│   │   ├── backtest/         # /backtest
│   │   ├── validation/       # /validation (north-star results)
│   │   ├── v4/               # /v4
│   │   └── ...               # explore, library, liquidity, ...
│   ├── api/                  # 33 API routes (auto-mounted)
│   └── layout.tsx            # Root layout (Header + AppShell)
├── components/               # React components (UI primitives + app)
├── lib/
│   ├── analytics/            # risk.ts (VaR, Sharpe, Sortino, ...)
│   ├── data/                 # data adapters (free + paid)
│   ├── simulation/           # V3 in-range math, portfolio composition
│   └── constants.ts          # chain IDs, RPC URLs, fee tiers
├── packages/sdk/             # Standalone ESM SDK @ticklab/sdk
├── scripts/
│   ├── validate-northstar.ts # North-star validation harness
│   ├── perf-bench.ts         # API latency benchmark
│   └── probe-*.ts            # One-off data probes
├── tests/                    # vitest suites (mirrors lib/)
├── marketing/                # Star campaign assets (logo, hero, OG, ...)
└── validation-results/       # CSVs from each harness run
```

## Submitting a pull request

1. **Branch off `master`.** Use a descriptive branch name:
   `feat/<verb>-<noun>`, `fix/<issue-number>-<noun>`, `docs/<noun>`.
2. **One logical change per PR.** If you find two unrelated things to
   fix, send two PRs — easier to review, easier to revert.
3. **Run the full check suite locally before pushing:**
   ```bash
   pnpm typecheck && pnpm test && pnpm lint
   ```
4. **Reference the issue.** If the PR closes an issue, write
   `Closes #NNN` in the description so the bot auto-links it.
5. **Describe the change in plain language.** What problem does this
   solve? What does the user see before/after? Any follow-up work
   that's intentionally deferred?
6. **Expect a review within 72 hours.** If you don't hear back, ping
   the issue. We're responsive but small.

## Reporting bugs

Use the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.md).
If you have a validation-harness regression specifically (your
simulator number suddenly disagrees with the ground truth), include:

- The CSV under `validation-results/` that shows the regression
- The pool address + commit hash where you first saw it
- The expected vs actual median absolute error

## Feature requests

Use the [feature request template](./.github/ISSUE_TEMPLATE/feature_request.md).
For V4 hooks, new chains, or new metrics, please check the [open
issues](https://github.com/Mine-FNL/ticklab/issues) first — there's a
good chance it's already scoped.

## Release process

Maintainers cut releases roughly weekly. Each release:

1. Bumps `version` in `package.json` and `packages/sdk/package.json`
2. Adds an `## [x.y.z] — YYYY-MM-DD` section to `CHANGELOG.md` with
   the Keep-a-Changelog grouping (Added / Changed / Fixed / Removed)
3. Tags `vX.Y.Z` and pushes — GitHub Actions builds + publishes the
   SDK to npm via OIDC trusted publishing (no manual token).

## License

By contributing, you agree that your contributions will be licensed
under the project's [MIT License](./LICENSE).