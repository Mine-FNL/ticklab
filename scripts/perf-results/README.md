# Performance benchmark results

This directory documents how to run and interpret the API latency
benchmark. See `../perf-bench.ts` for the harness.

## Goal

A16Z-grade production readiness means **knowing your p50/p95/p99
latency under load**, not guessing. This harness measures four things:

1. **Cold-start latency** — first request of each route (cold cache)
2. **Warm latency** — p50 / p95 / p99 over N samples per route per
   concurrency level
3. **Throughput** — requests/sec sustained at each concurrency level
4. **Error rate** — 4xx / 5xx / network failures broken out separately

## Quick start

```bash
# Default: hits http://localhost:3000, samples=100, concurrency=[1,5,20,50]
npx tsx scripts/perf-bench.ts

# Against a deployed environment
PERF_BASE_URL=https://staging.example.com npx tsx scripts/perf-bench.ts

# Smoke mode — fast feedback during a deployment
PERF_SAMPLES=20 PERF_CONCURRENCY='1,10' npx tsx scripts/perf-bench.ts \
  --routes /api/health
```

Outputs:

- A summary table to stdout.
- A JSON file to `validation-results/perf-<timestamp>.json` (created
  if missing). Diff between two JSON files is the canonical regression
  signal.

### Environment knobs

| Variable             | Default                  | Notes                                                |
| -------------------- | ------------------------ | ---------------------------------------------------- |
| `PERF_BASE_URL`      | `http://localhost:3000`  | No trailing slash.                                   |
| `PERF_SAMPLES`       | `100`                    | Per (route, concurrency).                            |
| `PERF_WARMUP`        | `5`                      | Discards before timing — JIT, DNS, connection pool. |
| `PERF_CONCURRENCY`   | `1,5,20,50`              | Comma-separated.                                     |

### Subsetting routes

Anything after `--routes` is matched against default route paths.
Unknown paths exit with a friendly error.

```bash
# Only measure the cheap liveness endpoints
npx tsx scripts/perf-bench.ts --routes /api/health /api/metrics
```

## How to read the output

### The summary table

```
univ3-strategy-lab benchmark — http://localhost:3000
samples=100  warmup=5  concurrency=[1, 5, 20, 50]
──────────────────────────────────────────────────────────────────────────────

GET /api/health
concurrency  cold       p50        p95        p99        mean       min        max        rps         errors  statuses
──────────────────────────────────────────────────────────────────────────────
1            142.3ms    1.20ms     2.40ms     5.10ms     1.31ms     0.80ms     6.70ms     763 rps     0       200:100
5            142.3ms    1.45ms     3.10ms     7.30ms     1.78ms     0.90ms     8.10ms     2810 rps    0       200:100
20           142.3ms    4.20ms     9.10ms     18.40ms    5.20ms     2.10ms     28.10ms    3846 rps    0       200:100
50           142.3ms    14.80ms    35.60ms    72.10ms    18.70ms    4.30ms     110.20ms   2660 rps    0       200:100
```

#### What each column means

| Column        | What it is                                                       |
| ------------- | ---------------------------------------------------------------- |
| `cold`        | First request after warmup, measured alone. Cache cold.          |
| `p50`         | Median latency — 50% of warm requests were this fast or faster.  |
| `p95`         | 95% of requests were this fast or faster. **The SLO metric.**    |
| `p99`         | Tail. 1% of requests were this slow or slower.                   |
| `mean`        | Arithmetic mean over successful warm samples.                     |
| `min / max`   | Bounds of warm samples.                                          |
| `rps`         | Throughput = `successful_requests / wall_clock_ms × 1000`.       |
| `errors`      | Non-HTTP responses (network failure, timeout, abort).            |
| `statuses`    | Histogram of HTTP status codes (`200:100`, `429:3`, …).          |

Latencies are reported in **microseconds** (us), milliseconds (ms), or
seconds (s) depending on magnitude. The format chosen per-column keeps
the table readable across a 5-orders-of-magnitude range.

### Interpreting the numbers

#### p50 vs p95 vs p99

- **`p50`** is the **typical user experience**. Watch this for daily
  regressions.
- **`p95`** is the **SLO metric**. Use it for traffic-light dashboards;
  one-tail breaches are actionable.
- **`p99`** is the **tail**. Spikes here are the first sign of a
  downstream issue (RPC timeout, cold cache, third-party degradation).

#### Cold-start vs warm

- `cold` is **NOT a regression target** during steady-state benchmarks —
  it's a *floor* showing how the very first request behaves. Re-runs
  that happen after the server has been up for hours will all share the
  same cold value as long as the route code path doesn't change.
- A cold value that grows over time on the same artifact signals JIT
  inflation or asset-cache growth in the route module.

#### Throughput shape across concurrency

Healthy behavior:

```
concurrency  rps
1            100
5            450     (~5x scaling)
20           1500    (~3x scaling)
50           1800    (~1.2x scaling, flattens out)
```

A **flattening curve** at high concurrency is expected on a single-node
Next.js dev server (the route is event-loop bound). It is *not* a bug —
production Vercel deployments scale horizontally so you should care
about per-instance behavior more than aggregate rps.

**Inverse curves** — rps *decreasing* as concurrency grows — are the
real regression signal. Look for that.

#### Error budgets

- A handful of `5xx` at `concurrency=50` on `/api/simulations` is fine
  if you see `429` in the same row — the route's rate-limit preset
  (`compute`, 30/min) intentionally clamps chatty callers. The bench is
  not a rate-limiter bypass.
- `4xx` on `/api/pools?chainId=1` is a regression. There is no reason
  for that route to 4xx under load.
- Any `network_error` row at concurrency 1 is a real configuration bug.

### When does a number mean "regressed"?

A practical heuristic:

| Magnitude                    | Read                                                |
| ---------------------------- | --------------------------------------------------- |
| ≤ 5% p95 change              | Likely noise — re-run before reacting.              |
| 5–15% p95 change on one route| Probably real. Look at the diff in `max` and `p99`. |
| 15–30% p95 change            | Almost certainly real. Bisect commit history.       |
| > 30% p95 change             | Definitely real. Investigate before merging.        |
| > 2x p99 spike               | Suspect a timeout, downstream throttle, or GC pause.|

The same shape holds for `rps`: a 2x throughput drop at the same
concurrency level is a much louder signal than a 10% p95 bump.

## Diffing two runs

```bash
# Capture a baseline
npx tsx scripts/perf-bench.ts > /dev/null
BASELINE=$(ls -t validation-results/perf-*.json | sed -n 2p)
CURRENT=$(ls -t validation-results/perf-*.json | sed -n 1p)

# Pretty diff (jq path filter helps — the file is large)
diff <(jq '.combinations[] | {route: .route.label, concurrency, p50: .warm.p50Us, p95: .warm.p95Us, p99: .warm.p99Us, rps: .warm.throughputRps}' "$BASELINE") \
     <(jq '.combinations[] | {route: .route.label, concurrency, p50: .warm.p50Us, p95: .warm.p95Us, p99: .warm.p99Us, rps: .warm.throughputRps}' "$CURRENT")
```

For a CI-friendly signal, parse the JSON and assert:

```js
const cur = JSON.parse(readFileSync(process.argv[2]));
for (const c of cur.combinations) {
  if (c.warm.p95Us > REGRESSION_BUDGET_US[c.route.path]) {
    process.exit(1);
  }
}
```

The benchmark is **zero-dependency and deterministic** — running it
twice in a row against the same server typically produces p95 numbers
within 5% of each other. Use the difference between consecutive runs as
your noise floor.

## What this benchmark is NOT

- **Not a load-generator for capacity planning.** Use k6 or Artillery
  for that — they emit per-route histograms and a real distribution
  of think-times. This harness is sized for a *regression guard*, not
  for "how much traffic can the box take".
- **Not a substitute for APM.** A single p95 number hides outages. Pair
  this with the existing Prometheus `/api/metrics` route (already
  auto-instrumented as of commit `344d97e`) for in-production visibility.
- **Not a correctness check.** It verifies response *timing*, not the
  business logic. Use `npm test` for that.

## Files

```
scripts/
├── perf-bench.ts          # the harness (zero-dependency, Node 18+)
└── perf-results/
    └── README.md          # this file

tests/
└── perf-bench.test.ts     # unit tests of percentile math + mock-fetch

validation-results/
└── perf-<timestamp>.json  # one file per run (gitignored via dockerignore)
```
