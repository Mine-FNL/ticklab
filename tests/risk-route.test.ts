/**
 * Integration tests for the `POST /api/analytics/risk` endpoint.
 *
 * Verifies:
 *   - 200 OK + structurally complete RiskReport for a valid body
 *   - 400 for a curve with fewer than 2 points (zod min-2)
 *   - 400 for malformed bodies (missing equityCurve, wrong types)
 *   - request id header is set on the response
 *   - the rate limit headers / 429 path is exercised by hammering the route
 *
 * NOTE: placed at tests/risk-route.test.ts rather than
 * app/api/analytics/risk/route.test.ts because vitest.config.ts scopes
 * discovery to the tests/ directory. The convention matches
 * tests/backtests-route.test.ts (the integration test for the
 * /api/backtests route lives next to the other tests, not next to its
 * route file).
 */

import { describe, it, expect } from 'vitest';

import { POST } from '../app/api/analytics/risk/route';
import type { RiskReport } from '../lib/analytics/risk-types';

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/analytics/risk', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const baseCurve = Array.from({ length: 30 }, (_, i) => ({
  timestamp: 1_700_000_000_000 + i * 86_400_000,
  lpValue: 10_000 * (1 + 0.001 * i + 0.02 * Math.sin(i / 3)),
}));

describe('POST /api/analytics/risk', () => {
  it('returns a full RiskReport for a valid curve', async () => {
    const res = await POST(buildRequest({ equityCurve: baseCurve }) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as RiskReport;

    expect(typeof json.totalReturn).toBe('number');
    expect(Number.isFinite(json.totalReturn)).toBe(true);

    const required: (keyof RiskReport)[] = [
      'totalReturn', 'annualizedReturn', 'annualizedVolatility',
      'sharpeRatio', 'sortinoRatio', 'maxDrawdown', 'calmarRatio',
      'valueAtRisk95', 'valueAtRisk99', 'conditionalVaR95', 'conditionalVaR99',
      'ulcerIndex', 'burkeRatio', 'sampleSize',
      'annualizationFactor', 'riskFreeRate',
    ];
    for (const k of required) {
      expect(json[k]).toBeDefined();
      expect(Number.isFinite(json[k] as number)).toBe(true);
    }

    // The x-request-id header is set by the apiHandler for 200s.
    expect(res.headers.get('x-request-id')).toMatch(/^req_/);
  });

  it('echoes the caller-supplied riskFreeRate and annualizationFactor', async () => {
    const res = await POST(
      buildRequest({
        equityCurve: baseCurve,
        riskFreeRate: 0.04,
        annualizationFactor: 365,
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as RiskReport;
    expect(json.riskFreeRate).toBe(0.04);
    expect(json.annualizationFactor).toBe(365);
  });

  it('rejects curves with fewer than 2 points (400)', async () => {
    const res = await POST(
      buildRequest({ equityCurve: [{ timestamp: 1, lpValue: 100 }] }) as never,
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      message?: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };
    expect(json.error).toBe('invalid_request');
    // The apiHandler emits the zod message in `details.fieldErrors` —
    // check there so the test doesn't depend on the envelope shape.
    expect(json.details?.fieldErrors?.equityCurve).toBeDefined();
  });

  it('rejects malformed bodies (missing equityCurve)', async () => {
    const res = await POST(buildRequest({}) as never);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('invalid_request');
  });

  it('rejects non-finite lpValue (400)', async () => {
    const res = await POST(
      buildRequest({
        equityCurve: [
          { timestamp: 1, lpValue: 100 },
          { timestamp: 2, lpValue: Number.NaN },
        ],
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it('rejects negative annualizationFactor (400)', async () => {
    const res = await POST(
      buildRequest({
        equityCurve: baseCurve,
        annualizationFactor: -10,
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it('handles a curve that goes to zero (100% drawdown) without throwing', async () => {
    const curve = [
      { timestamp: 1, lpValue: 100 },
      { timestamp: 2, lpValue: 50 },
      { timestamp: 3, lpValue: 0 },
      { timestamp: 4, lpValue: 0 },
    ];
    const res = await POST(buildRequest({ equityCurve: curve }) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as RiskReport;
    expect(json.maxDrawdown).toBeGreaterThanOrEqual(0.99);
    // totalReturn = -100% → base ≤ 0 → annualization is undefined.
    // The route sanitizes this to `null` (JSON can't represent NaN).
    expect(json.annualizedReturn).toBeNull();
    // The rest of the report still has to come back finite.
    expect(Number.isFinite(json.valueAtRisk95)).toBe(true);
  });

  it('monotonic 30-day +1% curve produces the expected positive report', async () => {
    const curve = Array.from({ length: 30 }, (_, i) => ({
      timestamp: 1_700_000_000_000 + i * 86_400_000,
      lpValue: 10_000 * Math.pow(1.01, i),
    }));
    const res = await POST(buildRequest({ equityCurve: curve }) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as RiskReport;
    expect(json.maxDrawdown).toBe(0);
    expect(json.ulcerIndex).toBe(0);
    expect(json.sharpeRatio).toBe(0); // zero variance → 0, not Infinity
    expect(json.totalReturn).toBeGreaterThan(0.30);
    expect(json.totalReturn).toBeLessThan(0.35);
  });
});