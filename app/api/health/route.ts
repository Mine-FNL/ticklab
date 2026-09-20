/**
 * GET /api/health
 *
 * Liveness + readiness + dependency smoke-checks.
 *
 * Back-compat: the original `{status, service, version, uptimeSeconds, timestamp}`
 * shape is preserved by emitting the same fields under their original names.
 * New fields (`uptime`, `buildSha`, `node`, `checks`) extend without breaking.
 *
 * The route always returns HTTP 200 — callers should inspect `status`
 * (`'ok' | 'degraded'`) and the `checks[]` array for the real signal. This
 * lets Kubernetes / Docker / load balancers treat any reachable response as
 * "process up" while a real APM watches for `degraded`.
 */

import { apiHandler, apiConfig } from '@/lib/api/handler';

export const { dynamic, runtime } = apiConfig();

export interface HealthCheck {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  uptimeSeconds: number; // original field, kept for back-compat
  uptime: number; // new, raw `process.uptime()` (seconds, float)
  timestamp: string;
  version: string;
  buildSha: string;
  node: string;
  checks: HealthCheck[];
}

/* -------------------------------------------------------------------------- */
/* Smoke checks                                                               */
/* -------------------------------------------------------------------------- */

/** Run a single GET against `url`, succeed if it returns within `timeoutMs`. */
async function probe(name: string, url: string, timeoutMs: number, expectStatus200: boolean): Promise<HealthCheck> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    const durationMs = Date.now() - started;
    const ok = expectStatus200 ? res.status === 200 : res.status > 0;
    return {
      name,
      ok,
      durationMs,
      ...(ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    return {
      name,
      ok: false,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Run smoke checks in parallel; tolerate individual failures. */
async function runChecks(): Promise<HealthCheck[]> {
  const TIMEOUT_MS = 3000;
  return Promise.all([
    probe('defillama', 'https://yields.llama.fi/pools', TIMEOUT_MS, true),
    probe('binance', 'https://api.binance.com/api/v3/ping', TIMEOUT_MS, true),
    probe('rpc', 'https://ethereum.publicnode.com', TIMEOUT_MS, false),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

export const GET = apiHandler<unknown, HealthReport>({
  name: 'health',
  schema: null,
  handler: async () => {
    const checks = await runChecks();
    const degraded = checks.some((c) => !c.ok);

    return {
      status: degraded ? 'degraded' : 'ok',
      service: 'ticklab',
      version: process.env.npm_package_version ?? '0.1.0',
      buildSha: process.env.BUILD_SHA ?? 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      node: process.version,
      checks,
    };
  },
});
