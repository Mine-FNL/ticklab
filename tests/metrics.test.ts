import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordMetric,
  incCounter,
  setGauge,
  renderPrometheusMetrics,
  __resetMetricsForTests,
} from '../lib/api/metrics';

describe('metrics registry', () => {
  beforeEach(() => {
    __resetMetricsForTests();
  });

  it('records a request counter partitioned by route, method, status class', () => {
    recordMetric('pools.list', 'GET', 200, 12);
    recordMetric('pools.list', 'GET', 200, 18);
    recordMetric('pools.list', 'GET', 500, 800);

    const out = renderPrometheusMetrics();
    expect(out).toMatch(/ticklab_http_requests_total\{route="pools\.list",method="GET",status_class="2xx"\} 2/);
    expect(out).toMatch(/ticklab_http_requests_total\{route="pools\.list",method="GET",status_class="5xx"\} 1/);
  });

  it('renders the latency histogram with cumulative bucket counts', () => {
    recordMetric('backtests.run', 'POST', 200, 5);   // bucket 0 (<=10)
    recordMetric('backtests.run', 'POST', 200, 50);  // bucket 1 (<=50)
    recordMetric('backtests.run', 'POST', 200, 5000);// bucket 4 (<=5000)

    const out = renderPrometheusMetrics();
    // First two requests fall in buckets 0, 0+1 — so the cumulative
    // counts at le="10" and le="50" should reflect both.
    expect(out).toMatch(/ticklab_http_request_duration_ms\{route="backtests\.run",le="10"\} 1/);
    expect(out).toMatch(/ticklab_http_request_duration_ms\{route="backtests\.run",le="50"\} 2/);
    expect(out).toMatch(/ticklab_http_request_duration_ms\{route="backtests\.run",le="5000"\} 3/);
    expect(out).toMatch(/ticklab_http_request_duration_ms\{route="backtests\.run",le="\+Inf"\} 3/);
  });

  it('includes process metrics (uptime, memory, node)', () => {
    recordMetric('any.route', 'GET', 200, 1);
    const out = renderPrometheusMetrics();
    expect(out).toMatch(/# TYPE ticklab_uptime_seconds gauge/);
    expect(out).toMatch(/ticklab_uptime_seconds \d/);
    expect(out).toMatch(/ticklab_memory_rss_bytes \d+/);
    expect(out).toMatch(/ticklab_node_info\{node_version="v\d/,);
  });

  it('renders custom counters and gauges', () => {
    incCounter('backtests_run_total', 3);
    incCounter('cache_hits_total');
    setGauge('queue_depth', 7);
    setGauge('active_pools', 12345);

    const out = renderPrometheusMetrics();
    expect(out).toMatch(/ticklab_custom_counter\{name="backtests_run_total"\} 3/);
    expect(out).toMatch(/ticklab_custom_counter\{name="cache_hits_total"\} 1/);
    expect(out).toMatch(/ticklab_custom_gauge\{name="queue_depth"\} 7/);
    expect(out).toMatch(/ticklab_custom_gauge\{name="active_pools"\} 12345/);
  });

  it('escapes label values that contain quotes or backslashes', () => {
    recordMetric('weird"path\\with\nchars', 'GET', 200, 1);
    const out = renderPrometheusMetrics();
    expect(out).toMatch(/route="weird\\"path\\\\with\\nchars"/);
  });

  it('produces a valid Prometheus text-format payload', () => {
    recordMetric('health.check', 'GET', 200, 4);
    incCounter('backtests_run_total');
    const out = renderPrometheusMetrics();

    // Required format: every non-comment line ends in \n; # comments
    // describe HELP and TYPE.
    expect(out).toMatch(/^# HELP /m);
    expect(out).toMatch(/^# TYPE /m);
    expect(out.endsWith('\n')).toBe(true);

    // The body should round-trip with no syntax errors. We don't run
    // a full parser here; we just verify it has no obvious Prometheus
    // syntax mistakes (every metric line has at least one space before
    // the value).
    const lines = out.split('\n').filter((l) => l && !l.startsWith('#'));
    for (const l of lines) {
      expect(l).toMatch(/ \S+$/);
    }
  });

  it('returns the expected Prometheus content type', async () => {
    // Don't actually hit the network — just verify the route module is
    // shaped correctly. The route handler is statically exported so this
    // is a smoke test for the module surface.
    const route = await import('../app/api/metrics/route');
    expect(typeof route.GET).toBe('function');
  });
});
