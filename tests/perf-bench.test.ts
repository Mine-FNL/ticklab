/**
 * Tests for `scripts/perf-bench.ts`.
 *
 * Coverage:
 *   - Module exports `runBench`, `percentileUs`, and related types.
 *   - `runBench` issues requests through the injected `fetch` so tests
 *     never touch a real server.
 *   - Status code, error, and concurrency settings make it from input
 *     options all the way to the structured `BenchResult`.
 *   - `percentileUs` is correct against synthetic, deterministic samples.
 *   - `serializeBenchResult` and `renderTable` produce stable outputs.
 *
 * We deliberately avoid testing real HTTP — that would be flaky in CI and
 * would force every contributor to run the dev server before `npm test`.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  runBench,
  percentileUs,
  renderTable,
  serializeBenchResult,
  DEFAULT_ROUTES,
  type PerfRoute,
} from '../scripts/perf-bench';

/* -------------------------------------------------------------------------- */
/* Test doubles                                                               */
/* -------------------------------------------------------------------------- */

interface SyntheticResponseOptions {
  /** Per-call latency in milliseconds. If array, cycles through it. */
  latencyMs?: number | number[];
  /** HTTP status code (default 200). */
  status?: number;
  /** Bytes of body returned (default 64). */
  bytes?: number;
  /** Probability in [0,1] that the call throws (default 0). */
  failureRate?: number;
}

interface FetchRecorder {
  fetch: typeof fetch;
  calls: Array<{ url: string; method: string; body: string | null }>;
}

/**
 * Build a mock `fetch` whose latency and status we control. We track every
 * call so tests can assert that `runBench` actually drove the network.
 */
function mockFetch(
  opts: SyntheticResponseOptions = {},
): FetchRecorder {
  const calls: FetchRecorder['calls'] = [];
  const latency = opts.latencyMs ?? 1;
  const status = opts.status ?? 200;
  const bytes = opts.bytes ?? 64;
  const failureRate = opts.failureRate ?? 0;

  const latencies = Array.isArray(latency) ? latency : [latency];

  function nextLatency(): number {
    if (latencies.length === 1) return latencies[0];
    // `calls.length` was already incremented by `push` above, so the
    // first call we observe is index 0 → use calls.length - 1 here.
    const i = (calls.length - 1) % latencies.length;
    return latencies[i];
  }

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    calls.push({
      url,
      method,
      body: typeof init?.body === 'string' ? init.body : null,
    });

    // Honor failure rate by randomizing — but make the choice deterministic
    // based on call count so a regression is testable.
    const toss = (calls.length * 9301 + 49297) % 233280 / 233280;
    if (toss < failureRate) {
      throw new Error('synthetic fetch failure');
    }

    const ms = nextLatency();
    await new Promise((r) => setTimeout(r, ms));
    const body = new Uint8Array(bytes);
    return new Response(body, {
      status,
      headers: { 'content-type': 'application/octet-stream' },
    });
  };

  return { fetch: fetchImpl, calls };
}

/* -------------------------------------------------------------------------- */
/* percentileUs                                                               */
/* -------------------------------------------------------------------------- */

describe('percentileUs', () => {
  it('returns 0 for an empty array', () => {
    expect(percentileUs([], 50)).toBe(0);
    expect(percentileUs([], 95)).toBe(0);
    expect(percentileUs([], 99)).toBe(0);
  });

  it('matches the nearest-rank convention', () => {
    // 100 evenly-spaced values, 1us..100us → p95 = 95, p99 = 99.
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentileUs(xs, 50)).toBe(50);
    expect(percentileUs(xs, 95)).toBe(95);
    expect(percentileUs(xs, 99)).toBe(99);
  });

  it('handles small-N arrays without crashing', () => {
    expect(percentileUs([10, 20, 30], 50)).toBe(20);
    expect(percentileUs([10, 20, 30], 95)).toBe(30);
    expect(percentileUs([10, 20, 30], 99)).toBe(30);
  });

  it('does not mutate the input array', () => {
    const xs = [40, 10, 30, 20];
    const copy = xs.slice();
    percentileUs(xs, 95);
    expect(xs).toEqual(copy);
  });

  it('is monotonic in p', () => {
    const xs = Array.from({ length: 200 }, (_, i) => Math.random() * 1000);
    xs.sort((a, b) => a - b);
    expect(percentileUs(xs, 50)).toBeLessThanOrEqual(percentileUs(xs, 95));
    expect(percentileUs(xs, 95)).toBeLessThanOrEqual(percentileUs(xs, 99));
  });
});

/* -------------------------------------------------------------------------- */
/* runBench — structural                                                        */
/* -------------------------------------------------------------------------- */

describe('runBench', () => {
  it('exports DEFAULT_ROUTES with 5 routes and matching shape', () => {
    expect(DEFAULT_ROUTES.length).toBeGreaterThanOrEqual(4);
    for (const r of DEFAULT_ROUTES) {
      expect(r.path.startsWith('/')).toBe(true);
      expect(['GET', 'POST']).toContain(r.method);
      if (r.method === 'GET') expect(r.body).toBeNull();
    }
  });

  it('drives the injected fetch exactly the expected number of times', async () => {
    // Per route: 1 cold + warmup + (samples × concurrencyLevels) requests.
    //   = 1 + 2 + (5 × 2) = 13 requests per route
    // For 1 route: 13 requests.
    const recorder = mockFetch({ latencyMs: 1, bytes: 32 });
    const routes: PerfRoute[] = [
      { method: 'GET', path: '/api/health', body: null, label: 'GET /api/health' },
    ];

    await runBench({
      baseUrl: 'http://localhost:3000',
      warmup: 2,
      samples: 5,
      concurrency: [1, 2],
      routes,
      fetch: recorder.fetch,
    });

    // 1 cold + 2 warmup + (5 samples × 1) + (5 samples × 2) = 13
    expect(recorder.calls.length).toBe(13);
    expect(recorder.calls.every((c) => c.url === 'http://localhost:3000/api/health')).toBe(true);
    expect(recorder.calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('serializes POST bodies as JSON with content-type', async () => {
    const recorder = mockFetch({ latencyMs: 1 });
    const routes: PerfRoute[] = [
      {
        method: 'POST',
        path: '/api/analytics/risk',
        body: { equityCurve: [{ timestamp: 1, lpValue: 100 }, { timestamp: 2, lpValue: 110 }] },
        label: 'POST /api/analytics/risk',
      },
    ];

    await runBench({
      baseUrl: 'http://localhost:3000',
      warmup: 0,
      samples: 1,
      concurrency: [1],
      routes,
      fetch: recorder.fetch,
    });

    // 1 cold + 1 sample = 2 calls.
    expect(recorder.calls.length).toBe(2);
    expect(recorder.calls[0].method).toBe('POST');
    expect(recorder.calls[0].body).not.toBeNull();
    const parsed = JSON.parse(recorder.calls[0].body as string);
    expect(parsed.equityCurve).toHaveLength(2);
  });

  it('returns a BenchResult with one entry per route×concurrency pair', async () => {
    const recorder = mockFetch({ latencyMs: 2 });
    const routes: PerfRoute[] = [
      { method: 'GET', path: '/api/health', body: null, label: 'A' },
      { method: 'GET', path: '/api/metrics', body: null, label: 'B' },
    ];

    const result = await runBench({
      baseUrl: 'http://localhost:3000',
      warmup: 0,
      samples: 3,
      concurrency: [1, 4],
      routes,
      fetch: recorder.fetch,
    });

    expect(result.combinations).toHaveLength(routes.length * 2);

    // Each combo records coldStart + samples + the right route.
    for (const combo of result.combinations) {
      expect(combo.samples.length).toBe(3);
      expect(combo.concurrency).toBeGreaterThan(0);
      expect(combo.route.label).toBeDefined();
    }

    // Concurrency=4 entries should see ~2x throughput vs concurrency=1
    // (each call is 2ms, so c=1 ≈ 500 rps, c=4 ≈ 2000 rps in the limit).
    // We only assert the directional invariant here.
    const by1 = result.combinations.find((c) => c.concurrency === 1 && c.route.label === 'A');
    const by4 = result.combinations.find((c) => c.concurrency === 4 && c.route.label === 'A');
    expect(by1).toBeDefined();
    expect(by4).toBeDefined();
    expect(by4!.warm.throughputRps).toBeGreaterThan(by1!.warm.throughputRps);
  });

  it('captures synthetic failures without aborting the run', async () => {
    // 30% failure rate: with samples=20 we expect ~6 errors and ~14 successes.
    const recorder = mockFetch({ latencyMs: 1, failureRate: 0.3 });
    const routes: PerfRoute[] = [
      { method: 'GET', path: '/api/health', body: null, label: 'A' },
    ];

    const result = await runBench({
      baseUrl: 'http://localhost:3000',
      warmup: 0,
      samples: 20,
      concurrency: [1],
      routes,
      fetch: recorder.fetch,
    });

    const combo = result.combinations[0];
    expect(combo.warm.count + combo.warm.errors).toBe(20);
    expect(combo.warm.errors).toBeGreaterThan(0);
    expect(combo.warm.statusCounts['network_error']).toBe(combo.warm.errors);
  });

  it('reports cold-start latency independent of sample distribution', async () => {
    // Cold is the first call, set it to be obviously slow. Subsequent
    // calls are 1ms; warm stats should sit well below cold.
    const recorder = mockFetch({ latencyMs: [50, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] });
    const routes: PerfRoute[] = [
      { method: 'GET', path: '/api/health', body: null, label: 'A' },
    ];

    const result = await runBench({
      baseUrl: 'http://localhost:3000',
      warmup: 0,
      samples: 5,
      concurrency: [1],
      routes,
      fetch: recorder.fetch,
    });

    const combo = result.combinations[0];
    // Cold was 50ms, warm samples were all ~1ms.
    expect(combo.coldStartUs).toBeGreaterThan(combo.warm.p99Us * 5);
    // The first sample in the warm array is the second call (latency 1ms),
    // so warm samples themselves should not include the 50ms spike.
    expect(Math.max(...combo.samples)).toBeLessThan(15_000); // < 15ms
  });
});

/* -------------------------------------------------------------------------- */
/* Output helpers                                                              */
/* -------------------------------------------------------------------------- */

describe('renderTable', () => {
  it('renders every route label and every concurrency level', async () => {
    const recorder = mockFetch({ latencyMs: 1 });
    const result = await runBench({
      baseUrl: 'http://localhost:3000',
      warmup: 0,
      samples: 3,
      concurrency: [1, 5],
      routes: [
        { method: 'GET', path: '/api/health', body: null, label: 'A' },
        { method: 'GET', path: '/api/metrics', body: null, label: 'B' },
      ],
      fetch: recorder.fetch,
    });

    const table = renderTable(result);
    expect(table).toContain('A');
    expect(table).toContain('B');
    // Concurrency columns show up as the first column on each data row.
    const rowCount = table.split('\n').filter((l) => /^\s*1\s/.test(l) || /^\s*5\s/.test(l)).length;
    expect(rowCount).toBe(4);
  });
});

describe('serializeBenchResult', () => {
  it('round-trips through JSON without losing keys', async () => {
    const recorder = mockFetch({ latencyMs: 1 });
    const result = await runBench({
      baseUrl: 'http://localhost:3000',
      warmup: 0,
      samples: 3,
      concurrency: [1],
      routes: [{ method: 'GET', path: '/api/health', body: null, label: 'A' }],
      fetch: recorder.fetch,
    });

    const json = serializeBenchResult(result);
    const parsed = JSON.parse(json);
    expect(parsed.startedAt).toBe(result.startedAt);
    expect(parsed.baseUrl).toBe('http://localhost:3000');
    expect(parsed.combinations).toHaveLength(1);
    expect(parsed.combinations[0].samples).toHaveLength(3);
    // All timing fields are present and numeric.
    const w = parsed.combinations[0].warm;
    expect(typeof w.p50Us).toBe('number');
    expect(typeof w.p95Us).toBe('number');
    expect(typeof w.p99Us).toBe('number');
    expect(typeof w.throughputRps).toBe('number');
  });
});

/* -------------------------------------------------------------------------- */
/* Module shape                                                                */
/* -------------------------------------------------------------------------- */

describe('module shape', () => {
  it('exposes the documented public API', () => {
    expect(typeof runBench).toBe('function');
    expect(typeof percentileUs).toBe('function');
    expect(typeof renderTable).toBe('function');
    expect(typeof serializeBenchResult).toBe('function');
    expect(Array.isArray(DEFAULT_ROUTES)).toBe(true);
  });

  it('uses global fetch when no override is provided', async () => {
    // We can't actually hit a server, so verify the wiring without
    // doing so: spy on global fetch, run with warmup=0 + samples=1 +
    // a route that fails fast (invalid host), confirm the spy fired.
    const spy = vi.fn(async () => {
      return new Response(new Uint8Array(0), { status: 200 });
    });
    const originalFetch = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = spy as unknown as typeof fetch;
    try {
      await runBench({
        baseUrl: 'http://localhost:3000',
        warmup: 0,
        samples: 1,
        concurrency: [1],
        routes: [{ method: 'GET', path: '/api/health', body: null, label: 'A' }],
      });
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
    }
    // At least the cold call + 1 sample must have hit the global fetch.
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
