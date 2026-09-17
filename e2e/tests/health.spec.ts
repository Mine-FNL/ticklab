import { test, expect, request } from '@playwright/test';

/**
 * /api/health end-to-end check.
 *
 * The endpoint always returns HTTP 200 (by design — load balancers should
 * treat any reachable response as "process up"). The real signal is in the
 * payload: `status` is 'ok' when all dependency smoke-checks pass and
 * 'degraded' when any check fails. See app/api/health/route.ts.
 */

interface HealthCheck {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  uptimeSeconds: number;
  uptime: number;
  timestamp: string;
  version: string;
  buildSha: string;
  node: string;
  checks: HealthCheck[];
}

test.describe('GET /api/health', () => {
  test('returns 200 and a healthy payload shape', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get('/api/health');
    expect(res.status(), 'health endpoint should always return 200').toBe(200);

    const body = (await res.json()) as HealthReport;

    expect(['ok', 'degraded']).toContain(body.status);
    expect(Array.isArray(body.checks), 'checks[] should be an array').toBe(true);
    expect(body.checks.length, 'checks[] should not be empty').toBeGreaterThan(0);

    const names = body.checks.map((c) => c.name);
    // DefiLlama + Binance + RPC are the three required upstream probes.
    expect(names).toContain('defillama');
    expect(names).toContain('binance');
    expect(names).toContain('rpc');

    for (const check of body.checks) {
      expect(typeof check.ok).toBe('boolean');
      expect(typeof check.durationMs).toBe('number');
    }

    // Invariant: if any check failed, status MUST be 'degraded'.
    const anyFailed = body.checks.some((c) => !c.ok);
    if (anyFailed) {
      expect.soft(body.status, 'any failed check should downgrade status to degraded').toBe('degraded');
    } else {
      expect.soft(body.status, 'all checks passing should report ok').toBe('ok');
    }
  });

  test('reports a version and buildSha', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get('/api/health');
    expect(res.status()).toBe(200);

    const body = (await res.json()) as HealthReport;
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
    expect(typeof body.buildSha).toBe('string');
    expect(typeof body.timestamp).toBe('string');
    // timestamp should parse as a date
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
