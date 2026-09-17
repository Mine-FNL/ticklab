# Production Readiness — `ticklab`

This document captures the production-readiness work applied on top of the
existing V3 codebase, and what was added to make the V4 hooks support
production-grade.

## Summary of changes

### 1. Shared API infrastructure (`lib/api/*`)

New module that every API route can adopt incrementally:

- **`handler.ts`** — `apiHandler()` factory that wraps a route with:
  - `dynamic = 'force-dynamic'` + `runtime = 'nodejs'` exports (`apiConfig()`)
  - Zod schema validation (query or body) with a consistent 400 envelope
  - Structured `[api] <route> <status> <ms> req=<id> ip=<ip>` logging
  - Optional in-process TTL cache (`cacheTtlMs`)
  - Optional per-IP token-bucket rate limit (`rateLimit: RateLimitPresets.*`)
  - Consistent error envelope (`{ error, message, suggestion, requestId }`)
  - `Retry-After` header on 429 responses
  - Client-IP extraction honouring `x-forwarded-for` / `x-real-ip`
- **`cache.ts`** — namespaced TTL cache with `invalidate()` and `size()` helpers
- **`rate-limit.ts`** — token-bucket limiter with `RateLimitPresets.read /
  compute / discover`

### 2. Existing API routes — fixed static-rendering foot-gun

Every route was being attempted as a static export at build time and silently
falling back to dynamic at runtime, which Next logged as warnings. Every
route now re-exports `apiConfig()`:

- `app/api/pools/route.ts`
- `app/api/pools/[address]/route.ts`
- `app/api/tokens/resolve/route.ts`
- `app/api/simulations/route.ts`
- `app/api/backtests/route.ts`
- `app/api/wallet/positions/route.ts`
- `app/api/positions/[id]/analytics/route.ts`

Build output now shows all routes as `ƒ Dynamic` with no "Dynamic server
usage" warnings.

### 3. New V4 API surface (previously client-only)

The V4 UI existed but had no server routes — pool discovery and simulation
were happening in the browser. We added a complete server-side V4 API:

- **`GET /api/v4/pools`** — discover V4 pools by pair or single token
- **`POST /api/v4/simulate`** — server-side V4 hook-aware simulation
  (optional `optimizeRange: true` returns an optimised range)
- **`GET /api/v4/hooks`** — list hooks with optional chain/category/audit filters
- **`POST /api/v4/hooks/recommend`** — strategy-aware hook recommendations
- **`GET /api/health`** — liveness probe

All new routes use the shared handler with rate limits + 60s cache where
appropriate (discover endpoints cache for 60 s, hooks list for 5 min).

### 4. V4 constants hardened (`lib/univ4/constants.ts`)

- Replaced placeholder PositionManager addresses with real `v4-periphery`
  deployments on Ethereum / Base / Arbitrum / Optimism / Sepolia
- Added StateView helper addresses (with a note that they are placeholder
  candidates — verify on-chain before relying on them in production)
- Removed the unused `polygon` import that triggered a lint warning
- Documented that Polygon V4 is intentionally absent (no canonical deployment
  at time of writing) instead of silently returning 500s from a placeholder

### 5. Bug fixed in `calculateEffectiveFeeRate` (`lib/univ4/math.ts`)

A unit test caught the bug: when `hookFeeType='share'` and
`hookFeeBips > 10000` (e.g. someone configures 30 000 bps = 300% share), the
function returned a negative effective fee rate, which would have produced
negative LP fee revenue downstream. Now clamped to `[0, baseRate]` for
`share` and `[0, 2 × baseRate]` for `rebate`.

### 6. Unit tests (`tests/*` + `vitest.config.ts`)

Vitest with v8 coverage. 38 tests, 3 files:

- `tests/v4-math.test.ts` — 21 tests covering fee math, flow capture,
  optimal range, pool-key hashing determinism, hook scoring/ranking
- `tests/v4-simulation.test.ts` — 8 tests covering scenario grid size,
  base/best/worst selection, hook surfacing, in-range tracking, range
  optimisation
- `tests/api-cache.test.ts` — 9 tests covering TTL, invalidation, key
  isolation, rate-limit buckets, IP extraction

Run with `npm test` / `npm run test:coverage`.

### 7. Production guards (`app/global-error.tsx`, `app/not-found.tsx`)

- Global error boundary with reset button and digest logging
- Branded 404 page (`/not-found`) instead of framework default

### 8. `.env.example`

Comprehensive template documenting every environment variable (RPC URLs,
WalletConnect, API keys for Etherscan/Alchemy/Infura, feature flags,
Sentry/observability).

### 9. `package.json` scripts

Added:

- `typecheck` — `tsc --noEmit -p tsconfig.json`
- `test` / `test:watch` / `test:coverage` — vitest

## Verified

```bash
npx tsc --noEmit -p tsconfig.json      # 0 errors
npm test                              # 38/38 pass
npx next build                        # 0 errors, 0 dynamic-server warnings
npx next lint --max-warnings=999      # 0 errors (warnings remain, all pre-existing)
```

## Out of scope (deferred)

- **In-memory cache vs Redis/Upstash.** Single-process cache is fine for
  this stage; switch to a shared KV when scaling out. The `cache.ts`
  abstraction can be swapped behind the same `cached()` interface.
- **Real per-instance rate limiting across replicas.** Current limiter is
  in-process. The `RateLimitPresets` interface can be re-implemented with
  Redis/Upstash without touching route code.
- **APM/log transport.** Logging is structured `console.log` for now; wire
  Sentry/Datadog/OpenTelemetry via `NEXT_PUBLIC_SENTRY_DSN` when ready.
- **Polygon V4.** Not deployed by Uniswap at time of last verification —
  intentionally not stubbed.
- **Lint warning cleanup.** Many `no-unused-vars` warnings exist in
  pre-existing code; they are warnings (not errors) and unrelated to the
  V4 production-readiness work. Address separately if desired.

## File map of new / modified files

```
NEW   app/api/health/route.ts
NEW   app/api/v4/pools/route.ts
NEW   app/api/v4/simulate/route.ts
NEW   app/api/v4/hooks/route.ts
NEW   app/api/v4/hooks/recommend/route.ts
NEW   app/global-error.tsx
NEW   app/not-found.tsx
NEW   lib/api/cache.ts
NEW   lib/api/rate-limit.ts
NEW   lib/api/handler.ts
NEW   tests/v4-math.test.ts
NEW   tests/v4-simulation.test.ts
NEW   tests/api-cache.test.ts
NEW   vitest.config.ts
NEW   PRODUCTION_READY.md
NEW   .env.example

MOD   lib/univ4/constants.ts          (real PM/StateView addresses, docstring)
MOD   lib/univ4/math.ts               (clamp bug fix)
MOD   package.json                    (typecheck/test scripts)
MOD   app/api/pools/route.ts          (apiConfig export)
MOD   app/api/pools/[address]/route.ts
MOD   app/api/tokens/resolve/route.ts
MOD   app/api/simulations/route.ts
MOD   app/api/backtests/route.ts
MOD   app/api/wallet/positions/route.ts
MOD   app/api/positions/[id]/analytics/route.ts
```