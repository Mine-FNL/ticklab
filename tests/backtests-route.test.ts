/**
 * Integration tests for the extended /api/backtests route.
 *
 * Verifies that the additive schema fields (useRealData, includeConfidence,
 * checklistInput) wire through to the underlying engines without breaking
 * the legacy shape.
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

// Stub the real-data engine to avoid hitting upstream APIs in CI.
vi.mock('@/lib/simulation/backtest-real', () => ({
  runRealBacktest: vi.fn(async () => ({
    historical: {
      totalReturn: 0.10,
      hodlReturn: 0.05,
      excessReturn: 0.05,
      totalFees: 100,
      realizedIL: -20,
      gasCosts: 5,
      rebalanceCount: 0,
      timeInRange: 0.85,
      periodsOutOfRange: 2,
      equityCurve: Array.from({ length: 35 }, (_, i) => ({
        timestamp: 1_700_000_000 + i * 86_400,
        lpValue: 10_000 * (1 + i * 0.001),
        hodlValue: 10_000 * (1 + i * 0.0005),
        fees: i * 3,
      })),
      drawdowns: [],
      bestWindow: { start: 0, end: 86_400, return: 0.01 },
      worstWindow: { start: 0, end: 86_400, return: -0.01 },
    },
    dataSource: 'defillama+modeled',
    dataPointsUsed: 35,
    fetchTimestamp: new Date().toISOString(),
  })),
}));

// Importing the route registers the POST handler; we invoke it directly.
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
  lowerTick: -100,
  upperTick: 100,
  depositAmount: '10000',
  depositToken: 'usd' as const,
  rebalanceMode: 'none' as const,
  gasCostGwei: 20,
};

describe('POST /api/backtests (extended)', () => {
  it('returns the legacy shape when no new flags are set', async () => {
    const res = await POST(buildRequest(baseBody) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.useRealData).toBe(false);
    expect(json.results).toBeDefined();
    expect(typeof json.results.totalReturn).toBe('number');
    expect(json.confidenceBands).toBeUndefined();
    expect(json.checklist).toBeUndefined();
  });

  it('attaches confidenceBands when includeConfidence=true (legacy path, 120-day window)', async () => {
    const longBody = {
      ...baseBody,
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-05-01T00:00:00.000Z', // 120 days → enough windows
      includeConfidence: true,
      confidenceWindowDays: 30,
    };
    const res = await POST(buildRequest(longBody) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.confidenceBands).toBeDefined();
    expect(typeof json.confidenceBands.p50).toBe('number');
    expect(json.confidenceBands.n).toBeGreaterThanOrEqual(5);
  });

  it('runs the checklist when checklistInput is provided', async () => {
    const res = await POST(
      buildRequest({
        ...baseBody,
        checklistInput: {
          chainId: 1,
          poolAddress: '0x0000000000000000000000000000000000000001',
          poolTvlUsd: 5_000_000,
          poolVolume24hUsd: 1_000_000,
          feeTierBips: 3000,
          estimatedEntrySizeUsd: 50_000,
          estimatedEntrySlippagePct: 0.5,
          token0Symbol: 'WETH',
          token1Symbol: 'USDC',
          isStablePair: false,
          expectedOutOfRangeProbability: 0.2,
        },
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.checklist).toBeDefined();
    expect(['go', 'caution', 'no-go']).toContain(json.checklist.overall);
    expect(Array.isArray(json.checklist.items)).toBe(true);
  });

  it('flags no-go on a dangerous checklist (un-audited hook, big size)', async () => {
    const res = await POST(
      buildRequest({
        ...baseBody,
        checklistInput: {
          chainId: 1,
          poolAddress: '0x0000000000000000000000000000000000000001',
          poolTvlUsd: 100_000,
          poolVolume24hUsd: 50,
          feeTierBips: 3000,
          estimatedEntrySizeUsd: 80_000, // 80% of pool TVL → block
          estimatedEntrySlippagePct: 6,  // > 5% → block
          hookAddress: '0x0000000000000000000000000000000000000abc',
          hookAuditStatus: 'unaudited', // → block
          token0Symbol: 'WETH',
          token1Symbol: 'USDC',
          isStablePair: false,
          expectedOutOfRangeProbability: 0.9, // > 0.8 → block
        },
      }) as never
    );
    const json = await res.json();
    expect(json.checklist.overall).toBe('no-go');
    expect(json.checklist.blockedReasons).toEqual(
      expect.arrayContaining(['hook_audit', 'tvl_minimum', 'position_size_vs_tvl']),
    );
  });

  it('useRealData=true returns dataSource and runs the real engine', async () => {
    const res = await POST(
      buildRequest({ ...baseBody, useRealData: true }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.useRealData).toBe(true);
    expect(json.dataSource).toBe('defillama+modeled');
    expect(typeof json.dataPointsUsed).toBe('number');
    expect(typeof json.fetchTimestamp).toBe('string');
  });

  it('rejects invalid addresses via zod (400)', async () => {
    const res = await POST(
      buildRequest({ ...baseBody, poolAddress: 'not-an-address' }) as never
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});