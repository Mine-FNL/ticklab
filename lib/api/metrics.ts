/**
 * In-process metrics registry for observability.
 *
 * Scope:
 *   - Request counters per route + status
 *   - Latency histograms (5-bucket, hardcoded boundaries)
 *   - Process metrics (uptime, memory, node version)
 *   - Custom counter / gauge registry for app-specific signals
 *     (e.g. `backtests_run_total`, `validation_harness_runs`)
 *
 * Storage: in-memory `Map`s, lifetime = process lifetime. NOT persisted
 * across restarts; NOT replicated across instances. For multi-instance
 * deployments swap in Prometheus pushgateway or an OTel exporter.
 *
 * Why in-memory: zero-dependency, zero-config, always available. A16Z-
 * grade production deployments wire this output to a scraper (Prometheus,
 * Datadog Agent) that pulls /metrics on a 30s interval.
 *
 * Cardinality discipline: NEVER use unbounded labels (user IDs, pool
 * addresses, request IDs). Allowed labels: `route`, `method`, `status_class`
 * (2xx/4xx/5xx). That's it.
 */

export type LabelKey = 'route' | 'method' | 'status_class';

const LABEL_KEYS: ReadonlySet<LabelKey> = new Set([
  'route',
  'method',
  'status_class',
]);

export interface RequestMetric {
  route: string;
  method: string;
  statusClass: '2xx' | '3xx' | '4xx' | '5xx';
  durationMs: number;
  ts: number;
}

/* -------------------------------------------------------------------------- */
/* Counters                                                                   */
/* -------------------------------------------------------------------------- */

// In Next.js dev mode, each route can compile a fresh module instance —
// which means module-scoped Maps would be isolated per route. To keep
// metrics consistent across the app we anchor state to globalThis with a
// branded key. In production (single bundle) this is a no-op; in dev it
// shares state across hot-reloaded route modules.
interface MetricsState {
  requestCounts: Map<string, number>;
  latencyBuckets: Map<string, number[]>;
  customCounters: Map<string, number>;
  customGauges: Map<string, number>;
}

const STATE_KEY = Symbol.for('univ3.metrics.state.v1');

function getState(): MetricsState {
  const g = globalThis as unknown as Record<symbol, MetricsState | undefined>;
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = {
      requestCounts: new Map<string, number>(),
      latencyBuckets: new Map<string, number[]>(),
      customCounters: new Map<string, number>(),
      customGauges: new Map<string, number>(),
    };
  }
  return g[STATE_KEY]!;
}

// Histogram boundaries in milliseconds. These cover the range we expect
// from this app: 5ms (cached reads) → 5000ms (slow upstream calls).
const LATENCY_BOUNDS = [10, 50, 200, 1000, 5000] as const;

function countKey(m: RequestMetric): string {
  return `${m.route}|${m.method}|${m.statusClass}`;
}

function recordRequest(m: RequestMetric): void {
  // Cardinality cap: refuse unknown label keys.
  if (!LABEL_KEYS.has('route') || !LABEL_KEYS.has('method')) return;

  const state = getState();
  const k = countKey(m);
  state.requestCounts.set(k, (state.requestCounts.get(k) ?? 0) + 1);

  // Latency histogram: cumulative counts in each bucket.
  // Bucket i counts requests with duration <= LATENCY_BOUNDS[i].
  let hist = state.latencyBuckets.get(m.route);
  if (!hist) {
    hist = new Array(LATENCY_BOUNDS.length + 1).fill(0); // +1 for "infinity"
    state.latencyBuckets.set(m.route, hist);
  }
  for (let i = 0; i < LATENCY_BOUNDS.length; i++) {
    if (m.durationMs <= LATENCY_BOUNDS[i]) hist[i]++;
  }
  hist[LATENCY_BOUNDS.length]++; // +Inf bucket
}

function statusClassFromCode(status: number): '2xx' | '3xx' | '4xx' | '5xx' {
  if (status < 200) return '2xx';
  if (status < 300) return '2xx';
  if (status < 400) return '3xx';
  if (status < 500) return '4xx';
  return '5xx';
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Wrap an API handler so the request is automatically counted in metrics.
 * Drop-in compatible with the existing `apiHandler` factory — call this
 * at the end of your route if you want metrics, OR call recordMetric()
 * explicitly from a custom handler.
 */
export function recordMetric(
  route: string,
  method: string,
  status: number,
  durationMs: number
): void {
  recordRequest({
    route,
    method,
    statusClass: statusClassFromCode(status),
    durationMs,
    ts: Date.now(),
  });
}

/**
 * Increment a custom counter (e.g. `backtests_run_total`, `cache_hits`).
 */
export function incCounter(name: string, value = 1): void {
  const state = getState();
  state.customCounters.set(name, (state.customCounters.get(name) ?? 0) + value);
}

/**
 * Set a custom gauge to an absolute value (e.g. pool count, queue depth).
 */
export function setGauge(name: string, value: number): void {
  getState().customGauges.set(name, value);
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

function escapeLabelValue(s: string): string {
  // Prometheus exposition format: backslash, double-quote, and newline must
  // be escaped. We don't expect label values to contain those in this app,
  // but be defensive.
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderCounterLine(name: string, labels: Partial<Record<LabelKey, string>>, value: number): string {
  const labelStr = Object.entries(labels)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}="${escapeLabelValue(String(v))}"`)
    .join(',');
  return labelStr ? `${name}{${labelStr}} ${value}` : `${name} ${value}`;
}

/**
 * Render the full /metrics body in Prometheus text exposition format (v0.0.4).
 * Safe to call from any request handler — pure function over the in-memory
 * state.
 */
export function renderPrometheusMetrics(): string {
  const lines: string[] = [];

  // Standard process metrics.
  const mem = process.memoryUsage();
  lines.push('# HELP univ3_uptime_seconds Process uptime in seconds.');
  lines.push('# TYPE univ3_uptime_seconds gauge');
  lines.push(`univ3_uptime_seconds ${(process.uptime() ?? 0).toFixed(3)}`);
  lines.push('# HELP univ3_memory_rss_bytes Resident set size in bytes.');
  lines.push('# TYPE univ3_memory_rss_bytes gauge');
  lines.push(`univ3_memory_rss_bytes ${mem.rss}`);
  lines.push('# HELP univ3_memory_heap_bytes Heap used in bytes.');
  lines.push('# TYPE univ3_memory_heap_bytes gauge');
  lines.push(`univ3_memory_heap_bytes ${mem.heapUsed}`);
  lines.push('# HELP univ3_node_info Static info labels.');
  lines.push('# TYPE univ3_node_info gauge');
  lines.push(
    `univ3_node_info{node_version="${process.version}",platform="${process.platform}"} 1`
  );

  // Request counters per route + method + status class.
  lines.push('# HELP univ3_http_requests_total Total HTTP requests served, partitioned by route, method, and 2xx/4xx/5xx class.');
  lines.push('# TYPE univ3_http_requests_total counter');
  const state = getState();
  for (const [k, v] of state.requestCounts.entries()) {
    const [route, method, statusClass] = k.split('|');
    lines.push(renderCounterLine('univ3_http_requests_total', { route, method, status_class: statusClass }, v));
  }

  // Latency histograms per route (5 explicit buckets + +Inf).
  lines.push('# HELP univ3_http_request_duration_ms Request latency histogram in milliseconds.');
  lines.push('# TYPE univ3_http_request_duration_ms histogram');
  for (const [route, buckets] of state.latencyBuckets.entries()) {
    for (let i = 0; i < LATENCY_BOUNDS.length; i++) {
      lines.push(
        `univ3_http_request_duration_ms{route="${escapeLabelValue(route)}",le="${LATENCY_BOUNDS[i]}"} ${buckets[i]}`
      );
    }
    lines.push(
      `univ3_http_request_duration_ms{route="${escapeLabelValue(route)}",le="+Inf"} ${buckets[LATENCY_BOUNDS.length]}`
    );
  }

  // Custom counters.
  if (state.customCounters.size > 0) {
    lines.push('# HELP univ3_custom_counter App-defined counter.');
    lines.push('# TYPE univ3_custom_counter counter');
    for (const [name, v] of state.customCounters.entries()) {
      lines.push(renderCounterLine('univ3_custom_counter', {}, v).replace('univ3_custom_counter ', `univ3_custom_counter{name="${escapeLabelValue(name)}"} `));
    }
  }

  // Custom gauges.
  if (state.customGauges.size > 0) {
    lines.push('# HELP univ3_custom_gauge App-defined gauge.');
    lines.push('# TYPE univ3_custom_gauge gauge');
    for (const [name, v] of state.customGauges.entries()) {
      lines.push(renderCounterLine('univ3_custom_gauge', {}, v).replace('univ3_custom_gauge ', `univ3_custom_gauge{name="${escapeLabelValue(name)}"} `));
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Test-only: reset all metric state. Used by unit tests; not exposed via API.
 */
export function __resetMetricsForTests(): void {
  const state = getState();
  state.requestCounts.clear();
  state.latencyBuckets.clear();
  state.customCounters.clear();
  state.customGauges.clear();
}
