/**
 * Regression tests for the /api/backtests pre-flight guards added after the
 * smoke test caught that extreme tick bounds + tight ranges yielded opaque
 * 500s. Now: 4xx with a clear message + suggestion.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/data/pools', () => ({
  getPoolByAddress: vi.fn(async () => ({
    address: '0x0000000000000000000000000000000000000001',
    token0: { address: '0x0000000000000000000000000000000000000002', symbol: 'T0', decimals: 18 },
    token1: { address: '0x0000000000000000000000000000000000000003', symbol: 'T1', decimals: 6 },
    feeTier: 3000,
    volumeUSD24h: 1_000_000,
  })),
}));

import { POST } from '../app/api/backtests/route';

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/backtests', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const baseBody = {
  poolAddress: '0x0000000000000000000000000000000000000001',
  chainId: 1,
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-02-01T00:00:00.000Z',
  depositAmount: '10000',
  depositToken: 'usd' as const,
  rebalanceMode: 'none' as const,
  gasCostGwei: 20,
  lowerTick: -1000,
  upperTick: 1000,
};

describe('POST /api/backtests pre-flight guards', () => {
  it('rejects lowerTick >= upperTick with 400 (was 500)', async () => {
    const res = await POST(
      buildRequest({ ...baseBody, lowerTick: 1000, upperTick: 1000 }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_request');
    expect(json.message).toMatch(/lowerTick must be/i);
    expect(json.suggestion).toMatch(/Widen/);
    expect(res.headers.get('x-request-id')).toMatch(/^req_/);
  });

  it('rejects inverted tick range with 400', async () => {
    const res = await POST(
      buildRequest({ ...baseBody, lowerTick: 1000, upperTick: -1000 }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_request');
  });

  it('rejects narrow range (< 60 ticks) with 400', async () => {
    const res = await POST(
      buildRequest({ ...baseBody, lowerTick: 0, upperTick: 30 }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_request');
    expect(json.message).toMatch(/too narrow|minimum is 60/);
  });

  it('happy path returns 200 + x-request-id + requestId in body', async () => {
    const res = await POST(buildRequest(baseBody) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toMatch(/^req_/);
    const json = await res.json();
    expect(json.requestId).toMatch(/^req_/);
  });

  it('Zod errors still 400 with details (regression)', async () => {
    const res = await POST(buildRequest({ ...baseBody, poolAddress: 'bad' }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_request');
    expect(json.requestId).toMatch(/^req_/);
  });
});