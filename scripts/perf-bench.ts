/**
 * Performance benchmark harness — `univ3-strategy-lab` HTTP API.
 *
 * Goal: A16Z-grade production readiness means knowing your p50/p95/p99
 * latency under load, not guessing. This harness measures:
 *
 *   1. Cold-start latency  — first request of each route (cache empty)
 *   2. Warm latency        — p50 / p95 / p99 over N samples
 *   3. Throughput          — requests/sec at each concurrency level
 *   4. Error rate          — 4xx / 5xx / network failures broken out
 *
 * Zero external dependencies — uses Node 18+ global `fetch` and
 * `performance.now()`. The output is meant to be diffed between runs:
 *
 *     $ npx tsx scripts/perf-bench.ts                  # full benchmark
 *     $ PERF_BASE_URL=https://staging.example.com \
 *       npx tsx scripts/perf-bench.ts                 # against staging
 *     $ PERF_SAMPLES=30 PERF_CONCURRENCY='1,10' \
 *       npx tsx scripts/perf-bench.ts --routes /api/health   # smoke mode
 *
 * Programmatic use (e.g. from a test):
 *
 *     import { runBench } from './scripts/perf-bench';
 *     const res = await runBench({
 *       baseUrl: 'http://localhost:3000',
 *       samples: 50,
 *       concurrency: [1, 5],
 *       warmup: 3,
 *       routes: [
 *         { method: 'GET', path: '/api/health', body: null },
 *       ],
 *       fetch: mockFetch,
 *     });
 */

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface PerfRoute {
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path beginning with `/`, e.g. `/api/health`. Query strings are allowed. */
  path: string;
  /**
   * Request body for non-GET routes. JSON-serialized and sent with
   * `content-type: application/json`. For GET, must be `null`.
   */
  body: unknown;
  /** Optional label for output. Defaults to `<METHOD> <path>`. */
  label?: string;
}

export interface RunBenchOptions {
  /** Base URL, e.g. `http://localhost:3000`. No trailing slash. */
  baseUrl: string;
  /** Number of warm samples discarded per (route, concurrency). Default 5. */
  warmup?: number;
  /** Number of timed samples per (route, concurrency). Default 100. */
  samples?: number;
  /** Concurrency levels to test. Default `[1, 5, 20, 50]`. */
  concurrency?: number[];
  /** Routes to benchmark. Defaults to a curated production set. */
  routes?: PerfRoute[];
  /**
   * Custom fetch implementation (used by tests to avoid hitting a real
   * server). Defaults to global `fetch`.
   */
  fetch?: typeof fetch;
  /** Number of samples per request (used by the test harness to keep mocks sane). */
  perRequestTimeoutMs?: number;
}

export interface SampleStats {
  count: number;
  errors: number;
  /** Microseconds — kept as floats because performance.now() is float ms. */
  minUs: number;
  maxUs: number;
  meanUs: number;
  p50Us: number;
  p95Us: number;
  p99Us: number;
  /** Throughput: total timed requests / total elapsed ms × 1000. */
  throughputRps: number;
  /** HTTP status code histogram (e.g. `{ '200': 100, '429': 7 }`). */
  statusCounts: Record<string, number>;
  /** Average response body size in bytes. */
  avgResponseBytes: number;
}

export interface BenchCombination {
  route: PerfRoute;
  concurrency: number;
  coldStartUs: number;
  warm: SampleStats;
  /** All individual timed samples, in microseconds. Sorted ascending on return. */
  samples: number[];
  /** Wall-clock duration of the timed run, in milliseconds. */
  elapsedMs: number;
}

export interface BenchResult {
  /** ISO timestamp at start. */
  startedAt: string;
  /** ISO timestamp at end. */
  finishedAt: string;
  baseUrl: string;
  options: {
    warmup: number;
    samples: number;
    concurrency: number[];
  };
  combinations: BenchCombination[];
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Minimal valid POST body for `POST /api/simulations`. The endpoint expects
 * a `simulationRequestSchema`-shaped payload. We pick the WETH/USDC 0.3%
 * pool address (a canonical mainnet pool) with an unrealistically wide tick
 * range so the route doesn't error out on data lookup or range validation.
 */
const SIMULATION_BODY = {
  poolAddress: '0x8ad599c3A0ff1De82b8e74b1F90d36B0e9b0a3C5',
  chainId: 1,
  depositAmount: '1000',
  depositToken: 'usd' as const,
  lowerTick: -200000,
  upperTick: 200000,
  type: 'deterministic' as const,
  horizonDays: 30,
  volumeScenario: 'base' as const,
  rebalanceMode: 'none' as const,
  gasCostGwei: 20,
};

/**
 * Minimal valid POST body for `POST /api/analytics/risk`. The zod schema
 * requires `equityCurve` with ≥ 2 points. 10 points is enough for the
 * pure-function module to produce a meaningful RiskReport without making
 * the request itself slow.
 */
const RISK_BODY = (() => {
  const curve = Array.from({ length: 10 }, (_, i) => ({
    timestamp: 1_700_000_000_000 + i * 86_400_000,
    lpValue: 10_000 * (1 + 0.001 * i),
  }));
  return { equityCurve: curve, riskFreeRate: 0, annualizationFactor: 252 };
})();

export const DEFAULT_ROUTES: PerfRoute[] = [
  { method: 'GET', path: '/api/health', body: null, label: 'GET /api/health' },
  { method: 'GET', path: '/api/metrics', body: null, label: 'GET /api/metrics' },
  {
    method: 'GET',
    path: '/api/pools?chainId=1',
    body: null,
    label: 'GET /api/pools?chainId=1',
  },
  {
    method: 'POST',
    path: '/api/simulations',
    body: SIMULATION_BODY,
    label: 'POST /api/simulations',
  },
  {
    method: 'POST',
    path: '/api/analytics/risk',
    body: RISK_BODY,
    label: 'POST /api/analytics/risk',
  },
];

/* -------------------------------------------------------------------------- */
/* HTTP timing                                                                */
/* -------------------------------------------------------------------------- */

interface SingleSample {
  status: number;
  elapsedUs: number;
  bytes: number;
  error?: string;
}

/**
 * Issue one request and time the round-trip with `performance.now()`.
 *
 * Timing resolution: `performance.now()` is sub-microsecond on every
 * supported runtime. We measure end-to-end wall clock — including any
 * X-Forwarded-For middleware, response serialization, and metrics
 * recording. This matches what users would experience.
 *
 * Errors are captured into the sample struct rather than thrown, so a
 * single 5xx doesn't abort the whole concurrency run.
 */
async function timeOneRequest(
  baseUrl: string,
  route: PerfRoute,
  f: typeof fetch,
  timeoutMs?: number,
): Promise<SingleSample> {
  const init: RequestInit = { method: route.method };
  if (route.body !== null && route.body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(route.body);
  }
  if (timeoutMs && timeoutMs > 0) {
    init.signal = AbortSignal.timeout(timeoutMs);
  }

  const url = new URL(route.path, baseUrl).toString();
  const start = performance.now();
  try {
    const res = await f(url, init);
    // Read body fully so timing reflects serialization too.
    const buf = await res.arrayBuffer();
    const elapsedUs = (performance.now() - start) * 1000;
    return {
      status: res.status,
      elapsedUs,
      bytes: buf.byteLength,
    };
  } catch (err) {
    const elapsedUs = (performance.now() - start) * 1000;
    return {
      status: 0,
      elapsedUs,
      bytes: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fire `n` requests at concurrency `c`. Batches are scheduled with
 * `Promise.all`; the wall clock is captured across all batches.
 *
 * Returns the per-sample raw samples and the elapsed wall clock so
 * throughput can be computed from the actual elapsed time (not a sum
 * of individual samples — at concurrency > 1 that would over-count).
 */
async function driveConcurrency(
  baseUrl: string,
  route: PerfRoute,
  samples: number,
  concurrency: number,
  f: typeof fetch,
  timeoutMs?: number,
): Promise<{ samples: SingleSample[]; elapsedMs: number }> {
  const out: SingleSample[] = new Array(samples);
  const t0 = performance.now();

  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = next++;
      if (i >= samples) return;
      out[i] = await timeOneRequest(baseUrl, route, f, timeoutMs);
    }
  });
  await Promise.all(workers);

  return { samples: out, elapsedMs: performance.now() - t0 };
}

/* -------------------------------------------------------------------------- */
/* Statistics                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Nearest-rank percentile — same convention used by Grafana / Datadog /
 * Prometheus when they say "p95". For N=100, p95 is the 95th-fastest value
 * (5th-slowest), not a linear interpolation. Floor + 1-indexed match the
 * way humans read "95 of every 100 requests were ≤ this number".
 *
 * Sorted ascending. `p` is in [0, 100]. Empty input returns 0.
 */
export function percentileUs(sortedUs: number[], p: number): number {
  if (sortedUs.length === 0) return 0;
  const rank = Math.max(1, Math.ceil((p / 100) * sortedUs.length));
  const idx = Math.min(rank - 1, sortedUs.length - 1);
  return sortedUs[idx];
}

function summarize(
  rawSamples: SingleSample[],
  elapsedMs: number,
): SampleStats {
  const successSamples = rawSamples.filter((s) => s.status > 0);
  const latenciesUs = successSamples.map((s) => s.elapsedUs).sort((a, b) => a - b);

  const count = successSamples.length;
  const errors = rawSamples.length - count;

  let minUs = 0;
  let maxUs = 0;
  let meanUs = 0;
  let p50Us = 0;
  let p95Us = 0;
  let p99Us = 0;
  let avgResponseBytes = 0;

  if (count > 0) {
    minUs = latenciesUs[0];
    maxUs = latenciesUs[latenciesUs.length - 1];
    let sum = 0;
    for (const v of latenciesUs) sum += v;
    meanUs = sum / count;
    p50Us = percentileUs(latenciesUs, 50);
    p95Us = percentileUs(latenciesUs, 95);
    p99Us = percentileUs(latenciesUs, 99);

    let bytes = 0;
    for (const s of successSamples) bytes += s.bytes;
    avgResponseBytes = bytes / count;
  }

  // Throughput from wall clock of the timed run (NOT summed per-sample
  // latencies — those would double-count at concurrency > 1).
  const throughputRps = elapsedMs > 0 ? (count / elapsedMs) * 1000 : 0;

  // Status code histogram.
  const statusCounts: Record<string, number> = {};
  for (const s of rawSamples) {
    const k = s.status === 0 ? 'network_error' : String(s.status);
    statusCounts[k] = (statusCounts[k] ?? 0) + 1;
  }

  return {
    count,
    errors,
    minUs,
    maxUs,
    meanUs,
    p50Us,
    p95Us,
    p99Us,
    throughputRps,
    statusCounts,
    avgResponseBytes,
  };
}

/* -------------------------------------------------------------------------- */
/* Runner                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Run the benchmark. Returns a structured result suitable for diffing or
 * for rendering. The function is intentionally generic over the `fetch`
 * implementation so tests can pass a mock and avoid hitting a real server.
 */
export async function runBench(opts: RunBenchOptions): Promise<BenchResult> {
  const {
    baseUrl,
    warmup = 5,
    samples = 100,
    concurrency = [1, 5, 20, 50],
    routes = DEFAULT_ROUTES,
    fetch: f = globalThis.fetch.bind(globalThis),
    perRequestTimeoutMs,
  } = opts;

  const startedAt = new Date().toISOString();
  const combinations: BenchCombination[] = [];

  for (const route of routes) {
    // ── Cold-start ────────────────────────────────────────────────────
    // Cold = first request after (re)start. We measure it BEFORE the
    // warmup discards so the warmup itself heats the OS / DNS / JIT.
    const cold = await timeOneRequest(baseUrl, route, f, perRequestTimeoutMs);
    const coldStartUs = cold.elapsedUs;
    const coldStatus = cold.status;

    // ── Warmup ────────────────────────────────────────────────────────
    // WARMUP requests are issued serially so they don't pollute the
    // timed run with first-batch JIT noise. We deliberately do NOT
    // include warmup timings in the sample set.
    for (let i = 0; i < warmup; i++) {
      await timeOneRequest(baseUrl, route, f, perRequestTimeoutMs);
    }

    for (const c of concurrency) {
      const { samples: rawSamples, elapsedMs } = await driveConcurrency(
        baseUrl,
        route,
        samples,
        c,
        f,
        perRequestTimeoutMs,
      );

      const warm = summarize(rawSamples, elapsedMs);
      combinations.push({
        route,
        concurrency: c,
        coldStartUs,
        warm,
        samples: rawSamples.map((s) => s.elapsedUs).sort((a, b) => a - b),
        elapsedMs,
      });
    }

    // Surface the cold status so the caller can fail fast on a route
    // that is misconfigured (e.g. wrong method, schema rejection, 404).
    void coldStatus;
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl,
    options: { warmup, samples, concurrency },
    combinations,
  };
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function pad(s: string, n: number, right = false): string {
  if (s.length >= n) return s.slice(0, n);
  const fill = ' '.repeat(n - s.length);
  return right ? fill + s : s + fill;
}

function fmtUs(us: number): string {
  if (us < 1000) return `${us.toFixed(1)}us`;
  const ms = us / 1000;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtRps(rps: number): string {
  if (rps < 1) return `${(rps * 1000).toFixed(0)}/min`;
  if (rps < 100) return `${rps.toFixed(2)} rps`;
  return `${rps.toFixed(0)} rps`;
}

/**
 * Group combinations by route label so we can render one block per route
 * with its concurrency levels in the rows.
 */
function groupByRoute(
  combinations: BenchCombination[],
): Map<string, { route: PerfRoute; rows: BenchCombination[] }> {
  const out = new Map<string, { route: PerfRoute; rows: BenchCombination[] }>();
  for (const c of combinations) {
    const key = c.route.label ?? `${c.route.method} ${c.route.path}`;
    let bucket = out.get(key);
    if (!bucket) {
      bucket = { route: c.route, rows: [] };
      out.set(key, bucket);
    }
    bucket.rows.push(c);
  }
  // Sort each bucket by ascending concurrency so the table reads naturally.
  for (const v of out.values()) v.rows.sort((a, b) => a.concurrency - b.concurrency);
  return out;
}

export function renderTable(result: BenchResult): string {
  const lines: string[] = [];
  const rule = '─'.repeat(110);
  const groups = groupByRoute(result.combinations);

  lines.push('');
  lines.push(`univ3-strategy-lab benchmark — ${result.baseUrl}`);
  lines.push(`started ${result.startedAt}   finished ${result.finishedAt}`);
  lines.push(`samples=${result.options.samples}  warmup=${result.options.warmup}  concurrency=[${result.options.concurrency.join(', ')}]`);
  lines.push(rule);

  for (const { route, rows } of groups.values()) {
    const title = route.label ?? `${route.method} ${route.path}`;
    lines.push('');
    lines.push(title);
    lines.push(
      [
        pad('concurrency', 12, true),
        pad('cold', 10, true),
        pad('p50', 10, true),
        pad('p95', 10, true),
        pad('p99', 10, true),
        pad('mean', 10, true),
        pad('min', 10, true),
        pad('max', 10, true),
        pad('rps', 12, true),
        pad('errors', 8, true),
        pad('statuses', 24, true),
      ].join(' '),
    );
    lines.push(rule);
    for (const row of rows) {
      const w = row.warm;
      const statuses = Object.entries(w.statusCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, n]) => `${k}:${n}`)
        .join(' ');
      lines.push(
        [
          pad(String(row.concurrency), 12, true),
          pad(fmtUs(row.coldStartUs), 10, true),
          pad(fmtUs(w.p50Us), 10, true),
          pad(fmtUs(w.p95Us), 10, true),
          pad(fmtUs(w.p99Us), 10, true),
          pad(fmtUs(w.meanUs), 10, true),
          pad(fmtUs(w.minUs), 10, true),
          pad(fmtUs(w.maxUs), 10, true),
          pad(fmtRps(w.throughputRps), 12, true),
          pad(String(w.errors), 8, true),
          pad(statuses || '-', 24, true),
        ].join(' '),
      );
    }
  }

  lines.push('');
  lines.push(rule);
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* JSON serialization                                                         */
/* -------------------------------------------------------------------------- */

export function serializeBenchResult(result: BenchResult): string {
  // Sort the per-combination sample arrays before serializing so the
  // JSON file is deterministic and percentile computations are stable
  // across runs (already sorted by `driveConcurrency`, but be explicit).
  const out: BenchResult = {
    ...result,
    combinations: result.combinations.map((c) => ({ ...c })),
  };
  return JSON.stringify(out, null, 2);
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Parse `--routes /api/health /api/metrics`-style argv into a subset of
 * the default routes. Unknown paths exit with a friendly error.
 */
function filterRoutesFromArgs(argv: string[]): PerfRoute[] {
  const idx = argv.indexOf('--routes');
  if (idx === -1) return DEFAULT_ROUTES;
  const wanted = new Set(argv.slice(idx + 1));
  const filtered = DEFAULT_ROUTES.filter((r) => {
    // Accept either bare path or `METHOD path`.
    const pathMatches = wanted.has(r.path);
    const labelled = wanted.has(`${r.method} ${r.path}`);
    return pathMatches || labelled;
  });
  if (filtered.length === 0) {
    const known = DEFAULT_ROUTES.map((r) => `${r.method} ${r.path}`).join(', ');
    throw new Error(`--routes matched none. Known: ${known}`);
  }
  return filtered;
}

async function main(): Promise<void> {
  const baseUrl = process.env.PERF_BASE_URL ?? 'http://localhost:3000';
  const warmup = Number(process.env.PERF_WARMUP ?? '5');
  const samples = Number(process.env.PERF_SAMPLES ?? '100');
  const concurrency = (process.env.PERF_CONCURRENCY ?? '1,5,20,50')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const routes = filterRoutesFromArgs(process.argv.slice(2));

  // eslint-disable-next-line no-console
  console.log(`[perf-bench] targeting ${baseUrl}`);

  const result = await runBench({
    baseUrl,
    warmup,
    samples,
    concurrency,
    routes,
  });

  // eslint-disable-next-line no-console
  console.log(renderTable(result));

  const outDir = resolve(process.cwd(), 'validation-results');
  mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = resolve(outDir, `perf-${ts}.json`);
  writeFileSync(outPath, serializeBenchResult(result), 'utf8');

  // eslint-disable-next-line no-console
  console.log(`[perf-bench] wrote ${outPath}`);
}

// Run when invoked directly; export when imported (for tests).
const isDirect = (() => {
  try {
    // ESM-friendly direct check without importing `node:url` (Node 18+).
    return (
      typeof process !== 'undefined' &&
      process.argv[1] !== undefined &&
      /perf-bench\.(ts|js)$/.test(process.argv[1])
    );
  } catch {
    return false;
  }
})();

if (isDirect) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[perf-bench] failed:', err);
    process.exit(1);
  });
}
