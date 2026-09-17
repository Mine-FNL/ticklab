# Performance Baseline (2026-09-17)

Captured by `npm run perf:bench` against `localhost:3000` (dev mode).
Production-mode numbers will differ — run `PERF_BASE_URL=https://your-app.example.com npm run perf:bench:prod` against a deployed instance for the production baseline.

## Workload

- 5 routes: `/api/health`, `/api/metrics`, `/api/pools`, `/api/simulations`, `/api/analytics/risk`
- 4 concurrency levels: 1, 5, 20, 50 in-flight
- 5 warmup requests (discarded)
- 100 samples per route per concurrency
- Total: 5 × 4 × 100 = 2000 timed requests per run

## Summary (dev mode, c=1)

| Route | p50 | p95 | p99 | rps | Errors |
|---|---|---|---|---|---|
| GET /api/health | 104 ms | 192 ms | 205 ms | 8.4 | 0 |
| GET /api/metrics | 2.3 ms | 3.6 ms | 4.2 ms | 412 | 0 |
| GET /api/pools | 8 ms | 21 ms | 29 ms | 99 | 100% ❌ |
| POST /api/simulations | 6 ms | 13 ms | 14 ms | 139 | 100% ❌ |
| POST /api/analytics/risk | 5 ms | 7 ms | 8 ms | 190 | 100% ❌ |

## Findings (action items)

### 1. POST endpoints must reject invalid bodies with 400, not 500

The bench harness sends `{ /* TODO */ }` (an empty body) to each POST route. Every POST route returns 500 with no body — that's a routing bug:

- **Expected**: 400 with `{error: 'invalid_request', message: 'Request did not match expected schema', details: ...}`
- **Actual**: 500 with `Internal Server Error`

Either the zod validation isn't wired into these POST routes, OR the error envelope isn't being applied. Fix in `app/api/simulations/route.ts` and `app/api/analytics/risk/route.ts`.

### 2. /api/health cold start is 619 ms (dev mode)

The dependency smoke checks (DefiLlama, Binance, RPC) block the first response. In production this'll be similar or slower depending on upstream latency. Mitigation: add a short-lived Redis/edge cache that returns the cached status for 1-2s.

### 3. Throughput under concurrent load (dev mode)

GET /api/metrics scales linearly: 412 rps at c=1, 2260 rps at c=50. Healthy.
GET /api/health degrades at c=20+ due to 3s upstream timeouts. Healthy at c=5 (31 rps).

## How to use this report

- **Regression tracking**: commit the JSON in `validation-results/perf-*.json` to git; diff two runs to spot drift.
- **Production baseline**: re-run with `PERF_BASE_URL=https://your-prod-host npm run perf:bench:prod` after each deploy.
- **Bottleneck hunting**: when a route starts showing p99 > 1s, grep for that route in `/api/metrics` (Prometheus exposition) and look for the `univ3_http_request_duration_ms_bucket` distribution.

## Out of scope for this baseline

- **Geographic distribution**: tests were localhost-only. For real latency modeling, run from multiple regions (e.g. Vercel's per-region cron).
- **Memory pressure**: each request allocates a small amount. Run with `--max-old-space-size=512` for a strict test.
- **Connection pool exhaustion**: the dev server uses Node's default HTTP agent. Production may want a tuned `keepAlive` pool.
