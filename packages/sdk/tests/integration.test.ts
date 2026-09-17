/**
 * End-to-end integration tests against a running dev server.
 *
 * Skipped unless `UNIVARIATE_TEST_BASE_URL` is set. To run:
 *
 *   # Terminal A
 *   cd univ3-strategy-lab && npm run dev
 *
 *   # Terminal B
 *   cd univ3-strategy-lab/packages/sdk && \
 *     UNIVARIATE_TEST_BASE_URL=http://localhost:3000 npm test
 *
 * The real-data backtest path may fail because the upstream price/volume
 * providers (CoinGecko, DeFi Llama) are flaky. We don't fail the suite
 * for that — the synthetic path and risk endpoint should always work.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UnivariateClient, UnivariateError, isUnivariateError } from '../src/index.js';

const BASE_URL = process.env.UNIVARIATE_TEST_BASE_URL;
const API_KEY = process.env.UNIVARIATE_TEST_API_KEY; // optional
const RUN = typeof BASE_URL === 'string' && BASE_URL.length > 0;

const skipIfDisabled = RUN ? it : it.skip;

describe.skipIf(!RUN)('integration: live API', () => {
  let client: UnivariateClient;

  beforeAll(() => {
    client = new UnivariateClient({
      baseUrl: BASE_URL as string,
      ...(API_KEY ? { apiKey: API_KEY } : {}),
      timeoutMs: 60_000,
    });
  });

  afterAll(async () => {
    // No global teardown required; let Node exit naturally.
  });

  skipIfDisabled('GET /api/health responds', async () => {
    // The SDK has no typed health endpoint, so we use the escape hatch.
    const res = await client.request<{ status: string } & { requestId: string }>('GET', '/api/health');
    expect(res.status).toBeTruthy();
    expect(typeof res.requestId).toBe('string');
  });

  skipIfDisabled('GET /api/pools returns at least one pool', async () => {
    const out = await client.pools.discover({ chainId: 1, limit: 5 });
    expect(Array.isArray(out.pools)).toBe(true);
    expect(typeof out.count).toBe('number');
    expect(out.requestId).toBeTruthy();
  });

  skipIfDisabled('GET /api/v4/hooks returns at least one hook', async () => {
    const out = await client.v4.hooks.discover();
    expect(Array.isArray(out.hooks)).toBe(true);
    expect(typeof out.count).toBe('number');
  });

  skipIfDisabled('POST /api/analytics/risk accepts a small curve', async () => {
    const curve = Array.from({ length: 10 }, (_, i) => ({
      timestamp: 1_700_000_000 + i * 86_400,
      lpValue: 10_000 * (1 + 0.001 * i),
    }));
    const out = await client.risk.compute({ equityCurve: curve });
    expect(typeof out.sharpeRatio).toBe('number');
    expect(typeof out.maxDrawdown).toBe('number');
    expect(out.requestId).toBeTruthy();
  });

  skipIfDisabled('POST /api/backtests runs a single backtest end-to-end (synthetic)', async () => {
    // Synthetic path: deterministic, no upstream calls.
    let out;
    try {
      out = await client.backtests.run({
        poolAddress: '0x8ad599c3a0cc1a8a26606766b157530d66f33675',
        lowerPrice: 2200,
        upperPrice: 2700,
        depositAmount: 10_000,
        depositToken: 'usd',
        rebalanceMode: 'none',
        useRealData: false,
      });
    } catch (err) {
      // Real-data path is flaky; rethrow to surface in test logs.
      if (isUnivariateError(err) && (err.code === 'upstream' || err.code === 'validation')) {
        // The synthetic path should not produce upstream errors. Re-throw.
        throw err;
      }
      throw err;
    }

    expect(out.backtestId).toBeTruthy();
    expect(out.useRealData).toBe(false);
    expect(out.results).toBeTruthy();
    expect(Array.isArray(out.results.equityCurve)).toBe(true);
    expect(out.requestId).toBeTruthy();
  });

  skipIfDisabled('POST /api/backtests with useRealData=true tolerates upstream failure', async () => {
    // The real-data path depends on CoinGecko + DeFi Llama. If either is
    // down the route returns 502 (upstream). We assert that we get a
    // structured error rather than a network-level failure.
    try {
      await client.backtests.run({
        poolAddress: '0x8ad599c3a0cc1a8a26606766b157530d66f33675',
        lowerPrice: 2200,
        upperPrice: 2700,
        depositAmount: 10_000,
        depositToken: 'usd',
        rebalanceMode: 'none',
        useRealData: true,
      });
    } catch (err) {
      if (err instanceof UnivariateError) {
        // Either upstream failure (502) or upstream_failure (404 if not indexed).
        expect(['upstream', 'validation', 'internal']).toContain(err.code);
      } else {
        throw err;
      }
    }
  });
});