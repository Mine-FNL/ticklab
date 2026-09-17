# UniV3 Strategy Lab — End-to-End Tests

Playwright-based browser tests that exercise the user-facing flows of the
repo's Next.js application (`/`):

| Flow                | Spec                                              |
| ------------------- | ------------------------------------------------- |
| Health probe        | [`tests/health.spec.ts`](./tests/health.spec.ts)            |
| Pool explorer       | [`tests/explore.spec.ts`](./tests/explore.spec.ts)          |
| Strategy builder    | [`tests/strategy-builder.spec.ts`](./tests/strategy-builder.spec.ts) |
| Historical backtest | [`tests/backtest-results.spec.ts`](./tests/backtest-results.spec.ts) |

The repo's existing 224 vitest tests cover API contracts and unit math; this
suite is the **real-browser** layer that proves the assembled UI actually
works for a real user.

## Install

```bash
cd e2e
npm install
npx playwright install chromium
```

> The `npm install` step pulls `@playwright/test`. The
> `playwright install chromium` step downloads the Chromium browser
> binaries (~150 MB). Both are required for the suite to run.

## Run

### Local (default — spins up `npm run dev` automatically)

```bash
cd e2e
npx playwright test
```

The Playwright config (`playwright.config.ts`) declares a `webServer`
block that starts `npm run dev` (cwd=`..`) and waits up to 120 s for
`http://localhost:3000` to be reachable. If a dev server is already
running on port 3000, `reuseExistingServer: true` keeps it.

### Targeted runs

```bash
# Just one spec
npx playwright test tests/health.spec.ts

# Just one project (only chromium is configured today)
npx playwright test --project=chromium

# Headed (visible browser)
npx playwright test --headed

# Debug mode (one spec, with Playwright Inspector)
npx playwright test --debug
```

### Against a different base URL

```bash
UNIVARIATE_BASE_URL=https://staging.example.com npx playwright test
```

The URL applies to both `webServer.url` (used to detect readiness) and
`use.baseURL` (used by `page.goto('/...')`). When you point at an
already-deployed environment, `reuseExistingServer` is still `true` in
non-CI mode and Playwright will skip launching `npm run dev`.

## CI

Set `CI=1` to switch the config into CI mode:

```bash
CI=1 npx playwright test
```

In CI:

- 1 worker, 2 retries, fail-fast on `.only`
- Reporters: GitHub annotations + HTML report (saved to
  `playwright-report/`)
- `test-results/` is emitted on failure (traces, screenshots, video)

Upload both `playwright-report/` and `test-results/` as build artifacts.

## Output artifacts

- `playwright-report/` — HTML report (open with `npx playwright show-report`)
- `test-results/` — on failure: trace, screenshot, video per failed test

`webServer` stdout/stderr is piped into the Playwright log; if a test
fails because the dev server didn't come up, scroll up for the Next.js
compile error.

## Selectors

All specs use accessibility-first locators: `page.getByRole`,
`page.getByLabel`, `page.getByPlaceholder`, `page.getByText`. CSS
class selectors are forbidden — refactors break those.

## Pre-seeding the store

The `/strategy` and `/backtest` pages are gated by `selectedPool` in the
Zustand store. We seed the store by writing a full snapshot to
localStorage before any page script runs (`page.addInitScript`). The
pool data comes from the running app's own `/api/pools/<address>`
endpoint so we never hard-code sqrtPriceX96 or tick values. See
`tests/_fixtures.ts` for details.

## Updating snapshots / recordings

This suite does **not** use Playwright's visual snapshot (`toHaveScreenshot`)
system — assertions are all functional. If the UI changes shape:

1. Re-run `npx playwright test --headed` to verify the locator still
   resolves.
2. If a locator is too tight (e.g. text changed), update the spec —
   keep using `getByRole` / `getByLabel` / `getByText` rather than
   reaching for CSS.
3. If a feature is removed, delete the corresponding assertion and
   update the table at the top of this file.

## Adding a new spec

1. Pick a flow that maps to a user task (e.g. "user opens the wallet panel").
2. Import `test, expect` from `./_fixtures` (NOT `@playwright/test`)
   so the pre-seeded store fixture is available.
3. Use the `seededPage` fixture when your flow needs a selected pool.
4. Avoid `waitForTimeout` — use `expect(locator).toBeVisible()` or
   `await locator.waitFor({ state: 'visible' })` instead.
5. Wrap upstream-dependent assertions in `expect.soft` or `test.skip`
   so a flaky data source never blocks CI.
