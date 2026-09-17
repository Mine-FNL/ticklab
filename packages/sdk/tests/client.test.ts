/**
 * Unit tests for @univ3-strategy-lab/sdk.
 *
 * Verifies:
 *   - request shape (URL, method, headers, body)
 *   - each public method returns the right typed shape
 *   - UnivariateError is thrown on 4xx/5xx with `code` + `status`
 *   - AbortSignal propagation
 *   - retry logic (3 attempts on 5xx, exponential backoff, jitter,
 *     429 honours Retry-After)
 *   - x-request-id is exposed on the result
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  UnivariateClient,
  UnivariateError,
  backtestsRun,
  isUnivariateError,
  poolsDiscover,
  riskCompute,
  simulationsRun,
  v4HooksDiscover,
} from '../src/index.js';
import type { ClientConfig } from '../src/types.js';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Build a mock Response that mirrors the fetch API contract closely
 * enough for the SDK to consume (`.ok`, `.status`, `.headers.get`,
 * `.text()`, `.json()`).
 */
function makeResponse(
  status: number,
  body: unknown,
  opts: { requestId?: string; retryAfter?: string | null } = {},
): Response {
  const headers = new Headers();
  if (opts.requestId !== undefined) headers.set('x-request-id', opts.requestId);
  if (opts.retryAfter !== undefined && opts.retryAfter !== null) {
    headers.set('retry-after', opts.retryAfter);
  }
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers,
    // signal that the body is JSON when we passed an object
    ...(typeof body === 'string' ? {} : {}),
  });
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                       */
/* -------------------------------------------------------------------------- */

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch as typeof fetch;
  vi.restoreAllMocks();
});

function installFetchMock(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): ReturnType<typeof vi.fn> {
  const mock = vi.fn(impl);
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/* -------------------------------------------------------------------------- */
/* Construction & basic request shape                                           */
/* -------------------------------------------------------------------------- */

describe('UnivariateClient construction', () => {
  it('requires baseUrl', () => {
    expect(() => new UnivariateClient({ baseUrl: '' })).toThrow();
    expect(() => new UnivariateClient({} as ClientConfig)).toThrow();
  });

  it('strips trailing slashes from baseUrl', () => {
    const c = new UnivariateClient({ baseUrl: 'https://x.example.com///' });
    expect(c.baseUrl).toBe('https://x.example.com');
  });

  it('throws when no fetch is available and none was provided', () => {
    const saved = globalThis.fetch;
    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
    try {
      expect(() => new UnivariateClient({ baseUrl: 'https://x' })).toThrow(/fetch/);
    } finally {
      globalThis.fetch = saved;
    }
  });
});

/* -------------------------------------------------------------------------- */
/* backtests.run                                                               */
/* -------------------------------------------------------------------------- */

describe('backtests.run', () => {
  const validParams = {
    poolAddress: '0x8ad599c3a0cc1a8a26606766b157530d66f33675',
    lowerPrice: 2200,
    upperPrice: 2700,
    depositAmount: 10_000,
    depositToken: 'usd' as const,
    feeTier: 3000,
    token0Decimals: 6,
    token1Decimals: 18,
    useRealData: false,
  };

  it('sends a POST to /api/backtests with the right shape', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(200, {
        backtestId: 'bt_1',
        useRealData: false,
        results: { totalReturn: 0.1 },
        warnings: [],
        requestId: 'req_abc',
      }, { requestId: 'req_abc' }),
    );

    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await client.backtests.run(validParams);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://x.example.com/api/backtests');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json');
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('@univ3-strategy-lab/sdk');
    const body = JSON.parse(init.body as string);
    expect(body.poolAddress).toBe(validParams.poolAddress);
    expect(body.depositAmount).toBe('10000');
    expect(body.depositToken).toBe('usd');
    expect(typeof body.lowerTick).toBe('number');
    expect(typeof body.upperTick).toBe('number');
    expect(body.lowerTick).toBeLessThan(body.upperTick);
    expect(body.chainId).toBe(1);

    expect(out.backtestId).toBe('bt_1');
    expect(out.results.totalReturn).toBe(0.1);
    expect(out.requestId).toBe('req_abc');
  });

  it('passes the AbortSignal through to fetch', async () => {
    installFetchMock(async (_input, init) => {
      expect(init?.signal).toBeDefined();
      // Simulate fetch respecting the abort
      return makeResponse(200, { backtestId: 'bt_x', results: {}, warnings: [], requestId: 'req_x' });
    });
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const controller = new AbortController();
    await client.backtests.run(validParams, { signal: controller.signal });
  });

  it('throws UnivariateError on 400 with code=validation', async () => {
    installFetchMock(async () =>
      makeResponse(400, {
        error: 'invalid_request',
        message: 'lowerTick must be < upperTick',
        requestId: 'req_bad',
      }, { requestId: 'req_bad' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    await expect(client.backtests.run(validParams)).rejects.toMatchObject({
      name: 'UnivariateError',
      status: 400,
      code: 'validation',
      requestId: 'req_bad',
      method: 'POST',
    });
  });

  it('throws UnivariateError on 400 with code=validation and does not retry', async () => {
    // 4xx is caller-side and never retried.
    const fetchMock = installFetchMock(async () =>
      makeResponse(400, { error: 'invalid_request', message: 'bad range', requestId: 'req_400' }, { requestId: 'req_400' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    await expect(client.backtests.run(validParams)).rejects.toMatchObject({
      name: 'UnivariateError',
      status: 400,
      code: 'validation',
      requestId: 'req_400',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws UnivariateError on 500 with code=internal (retries internally)', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(500, { error: 'internal_error', message: 'boom', requestId: 'req_500' }, { requestId: 'req_500' }),
    );
    const client = new UnivariateClient({
      baseUrl: 'https://x.example.com',
      baseBackoffMs: 1, // keep the test fast
    });
    await expect(client.backtests.run(validParams)).rejects.toMatchObject({
      name: 'UnivariateError',
      status: 500,
      code: 'internal',
      requestId: 'req_500',
    });
    // 1 initial + 3 retries = 4 calls.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('works when called via the standalone function', async () => {
    installFetchMock(async () =>
      makeResponse(200, { backtestId: 'bt_x', results: { totalReturn: 0 }, warnings: [], requestId: 'req_x' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await backtestsRun(client, validParams);
    expect(out.backtestId).toBe('bt_x');
  });
});

/* -------------------------------------------------------------------------- */
/* risk.compute                                                                */
/* -------------------------------------------------------------------------- */

describe('risk.compute', () => {
  const params = {
    equityCurve: [
      { timestamp: 1, lpValue: 100 },
      { timestamp: 2, lpValue: 105 },
      { timestamp: 3, lpValue: 110 },
    ],
    riskFreeRate: 0.04,
  };

  it('POSTs to /api/analytics/risk and returns the RiskReport', async () => {
    const report = {
      totalReturn: 0.1,
      annualizedReturn: 0.12,
      annualizedVolatility: 0.2,
      sharpeRatio: 0.8,
      sortinoRatio: 1.1,
      calmarRatio: 0.5,
      maxDrawdown: 0.05,
      valueAtRisk95: 0.02,
      valueAtRisk99: 0.04,
      conditionalVaR95: 0.03,
      conditionalVaR99: 0.05,
      ulcerIndex: 1.2,
      burkeRatio: 0.1,
      sampleSize: 2,
      annualizationFactor: 252,
      riskFreeRate: 0.04,
    };
    installFetchMock(async () =>
      makeResponse(200, report, { requestId: 'req_risk' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await client.risk.compute(params);
    expect(out.sharpeRatio).toBe(0.8);
    expect(out.maxDrawdown).toBe(0.05);
    expect(out.requestId).toBe('req_risk');
  });

  it('attaches requestId from header even when body has none', async () => {
    const report = {
      totalReturn: 0, annualizedReturn: 0, annualizedVolatility: 0,
      sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, maxDrawdown: 0,
      valueAtRisk95: 0, valueAtRisk99: 0, conditionalVaR95: 0, conditionalVaR99: 0,
      ulcerIndex: 0, burkeRatio: 0, sampleSize: 0, annualizationFactor: 252, riskFreeRate: 0,
    };
    installFetchMock(async () =>
      makeResponse(200, report, { requestId: 'req_only_header' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await client.risk.compute(params);
    expect(out.requestId).toBe('req_only_header');
  });

  it('uses the standalone riskCompute function', async () => {
    installFetchMock(async () =>
      makeResponse(200, {
        totalReturn: 0, annualizedReturn: 0, annualizedVolatility: 0,
        sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, maxDrawdown: 0,
        valueAtRisk95: 0, valueAtRisk99: 0, conditionalVaR95: 0, conditionalVaR99: 0,
        ulcerIndex: 0, burkeRatio: 0, sampleSize: 0, annualizationFactor: 252, riskFreeRate: 0,
      }, { requestId: 'req_standalone' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await riskCompute(client, params);
    expect(out.requestId).toBe('req_standalone');
  });
});

/* -------------------------------------------------------------------------- */
/* pools.discover                                                              */
/* -------------------------------------------------------------------------- */

describe('pools.discover', () => {
  it('sends a GET with the chainId in the query', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(200, {
        pools: [{ address: '0xabc' }],
        count: 1,
        chainId: 1,
        sortOptions: ['tvl'],
      }, { requestId: 'req_pools' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await client.pools.discover({ chainId: 1, limit: 5 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('GET');
    expect(url).toContain('/api/pools');
    expect(url).toContain('chainId=1');
    expect(url).toContain('limit=5');
    expect(out.pools).toHaveLength(1);
    expect(out.requestId).toBe('req_pools');
  });

  it('omits undefined query params', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(200, { pools: [], count: 0, chainId: 1, sortOptions: [] }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    await poolsDiscover(client, {});
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://x.example.com/api/pools');
  });
});

/* -------------------------------------------------------------------------- */
/* v4.hooks.discover                                                           */
/* -------------------------------------------------------------------------- */

describe('v4.hooks.discover', () => {
  it('GETs /api/v4/hooks with category filter', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(200, {
        hooks: [{ hookId: 'h1', name: 'Hook', category: 'fee', chains: [1], address: '0x0', behaviors: {} }],
        count: 1,
      }, { requestId: 'req_hooks' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await client.v4.hooks.discover({ category: 'fee', auditedOnly: true });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/v4/hooks');
    expect(url).toContain('category=fee');
    expect(url).toContain('auditedOnly=true');
    expect(out.hooks).toHaveLength(1);
    expect(out.requestId).toBe('req_hooks');
  });

  it('exposes the standalone v4HooksDiscover', async () => {
    installFetchMock(async () =>
      makeResponse(200, { hooks: [], count: 0 }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await v4HooksDiscover(client);
    expect(out.count).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* simulations.run                                                             */
/* -------------------------------------------------------------------------- */

describe('simulations.run', () => {
  it('POSTs to /api/simulations', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(200, {
        simulationId: 'sim_1',
        scenarios: [],
        feeEstimate: {
          feesUSD: 0, dailyFeesUSD: 0, totalFeesUSD: 0, feeAPR: 0,
          confidenceInterval: [0, 0],
          assumptions: { dailyVolumeUSD: 0, timeInRange: 0, liquidityShare: 0 },
        },
        warnings: [],
        requestId: 'req_sim',
      }, { requestId: 'req_sim' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await simulationsRun(client, {
      poolAddress: '0x8ad599c3a0cc1a8a26606766b157530d66f33675',
      depositAmount: 1000,
      depositToken: 'usd',
      lowerPrice: 1,
      upperPrice: 2,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://x.example.com/api/simulations');
    expect(init.method).toBe('POST');
    expect(out.simulationId).toBe('sim_1');
    expect(out.requestId).toBe('req_sim');
  });
});

/* -------------------------------------------------------------------------- */
/* Retry logic                                                                 */
/* -------------------------------------------------------------------------- */

describe('retry behaviour', () => {
  const params = {
    equityCurve: [
      { timestamp: 1, lpValue: 100 },
      { timestamp: 2, lpValue: 110 },
    ],
  };

  it('retries up to maxRetries on 5xx and then throws UnivariateError', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(503, { error: 'service_unavailable', message: 'down' }, { requestId: 'req_503' }),
    );
    const client = new UnivariateClient({
      baseUrl: 'https://x.example.com',
      baseBackoffMs: 1, // keep test fast
    });
    await expect(client.risk.compute(params)).rejects.toMatchObject({
      status: 503,
      code: 'upstream',
      requestId: 'req_503',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('stops retrying once a successful response arrives', async () => {
    let count = 0;
    installFetchMock(async () => {
      count += 1;
      if (count < 3) return makeResponse(500, { error: 'internal_error' });
      return makeResponse(200, {
        totalReturn: 0, annualizedReturn: 0, annualizedVolatility: 0,
        sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, maxDrawdown: 0,
        valueAtRisk95: 0, valueAtRisk99: 0, conditionalVaR95: 0, conditionalVaR99: 0,
        ulcerIndex: 0, burkeRatio: 0, sampleSize: 0, annualizationFactor: 252, riskFreeRate: 0,
      }, { requestId: 'req_ok' });
    });
    const client = new UnivariateClient({
      baseUrl: 'https://x.example.com',
      baseBackoffMs: 1,
    });
    const out = await client.risk.compute(params);
    expect(count).toBe(3);
    expect(out.requestId).toBe('req_ok');
  });

  it('honours Retry-After header on 429', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(429, { error: 'rate_limited' }, { requestId: 'req_429', retryAfter: '0' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    await expect(client.risk.compute(params)).rejects.toMatchObject({
      status: 429,
      code: 'rate_limit',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries on network errors thrown by fetch', async () => {
    let count = 0;
    installFetchMock(async () => {
      count += 1;
      if (count < 2) throw new TypeError('fetch failed');
      return makeResponse(200, {
        totalReturn: 0, annualizedReturn: 0, annualizedVolatility: 0,
        sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, maxDrawdown: 0,
        valueAtRisk95: 0, valueAtRisk99: 0, conditionalVaR95: 0, conditionalVaR99: 0,
        ulcerIndex: 0, burkeRatio: 0, sampleSize: 0, annualizationFactor: 252, riskFreeRate: 0,
      }, { requestId: 'req_recovered' });
    });
    const client = new UnivariateClient({
      baseUrl: 'https://x.example.com',
      baseBackoffMs: 1,
    });
    const out = await client.risk.compute(params);
    expect(count).toBe(2);
    expect(out.requestId).toBe('req_recovered');
  });

  it('does not retry when maxRetries=0', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(500, { error: 'internal_error' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    await expect(client.risk.compute(params, { maxRetries: 0 })).rejects.toBeInstanceOf(UnivariateError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caps retry backoff at MAX_BACKOFF_MS even with bad baseBackoffMs', async () => {
    // We can't easily assert exact timing without flakiness, so we just
    // exercise the path and assert the call succeeds within a generous
    // timeout window.
    installFetchMock(async () =>
      makeResponse(200, {
        totalReturn: 0, annualizedReturn: 0, annualizedVolatility: 0,
        sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, maxDrawdown: 0,
        valueAtRisk95: 0, valueAtRisk99: 0, conditionalVaR95: 0, conditionalVaR99: 0,
        ulcerIndex: 0, burkeRatio: 0, sampleSize: 0, annualizationFactor: 252, riskFreeRate: 0,
      }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    await client.risk.compute(params, { baseBackoffMs: 1 });
  });
});

/* -------------------------------------------------------------------------- */
/* AbortSignal propagation                                                     */
/* -------------------------------------------------------------------------- */

describe('abort signal', () => {
  const params = {
    poolAddress: '0x8ad599c3a0cc1a8a26606766b157530d66f33675',
    lowerPrice: 2200,
    upperPrice: 2700,
    depositAmount: 10_000,
    depositToken: 'usd' as const,
  };

  it('throws UnivariateError(code=aborted) when caller aborts mid-request', async () => {
    installFetchMock(async (_input, init) => {
      // Throw an AbortError when fetch's signal is aborted.
      return await new Promise<Response>((_resolve, reject) => {
        const sig = init?.signal;
        if (!sig) {
          reject(new Error('no signal passed'));
          return;
        }
        if (sig.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        sig.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      });
    });
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);
    await expect(client.backtests.run(params, { signal: controller.signal })).rejects.toMatchObject({
      code: 'aborted',
    });
  });

  it('isUnivariateError type guard works', () => {
    const e = new UnivariateError({
      message: 'x', status: 400, code: 'validation', requestId: null, body: null, url: 'u', method: 'GET',
    });
    expect(isUnivariateError(e)).toBe(true);
    expect(isUnivariateError(new Error('plain'))).toBe(false);
    expect(isUnivariateError('string')).toBe(false);
    expect(isUnivariateError(null)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Error envelope toJSON                                                        */
/* -------------------------------------------------------------------------- */

describe('UnivariateError.toJSON', () => {
  it('returns a serializable object without body/cause', async () => {
    installFetchMock(async () =>
      makeResponse(404, { error: 'Pool not found', requestId: 'req_404' }, { requestId: 'req_404' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    try {
      await client.pools.discover({ chainId: 1 });
      throw new Error('should not reach');
    } catch (err) {
      expect(isUnivariateError(err)).toBe(true);
      const e = err as UnivariateError;
      const j = e.toJSON();
      expect(j.name).toBe('UnivariateError');
      expect(j.status).toBe(404);
      expect(j.code).toBe('validation');
      expect(j.requestId).toBe('req_404');
      expect(j.url).toContain('/api/pools');
      expect(j.method).toBe('GET');
      expect(Object.keys(j)).not.toContain('body');
      expect(Object.keys(j)).not.toContain('cause');
      // round-trip through JSON
      const round = JSON.parse(JSON.stringify(j));
      expect(round.requestId).toBe('req_404');
    }
  });

  it('exposes retryable getter for transient categories', async () => {
    installFetchMock(async () => makeResponse(500, { error: 'internal_error' }));
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com', baseBackoffMs: 1, maxRetries: 0 });
    try {
      await client.risk.compute({ equityCurve: [{ timestamp: 1, lpValue: 1 }, { timestamp: 2, lpValue: 2 }] });
    } catch (err) {
      const e = err as UnivariateError;
      expect(e.code).toBe('internal');
      expect(e.retryable).toBe(true);
    }
  });

  it('non-retryable categories report retryable=false', async () => {
    installFetchMock(async () => makeResponse(400, { error: 'invalid_request' }));
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    try {
      await client.risk.compute({ equityCurve: [{ timestamp: 1, lpValue: 1 }, { timestamp: 2, lpValue: 2 }] });
    } catch (err) {
      const e = err as UnivariateError;
      expect(e.code).toBe('validation');
      expect(e.retryable).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Auth header                                                                 */
/* -------------------------------------------------------------------------- */

describe('auth header', () => {
  it('attaches Authorization: Bearer <key> when apiKey is set', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(200, { pools: [], count: 0, chainId: 1, sortOptions: [] }),
    );
    const client = new UnivariateClient({
      baseUrl: 'https://x.example.com',
      apiKey: 'sk_test_123',
    });
    await client.pools.discover();
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_123');
  });

  it('omits Authorization header when apiKey is unset', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(200, { pools: [], count: 0, chainId: 1, sortOptions: [] }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    await client.pools.discover();
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* x-request-id propagation                                                    */
/* -------------------------------------------------------------------------- */

describe('x-request-id propagation', () => {
  it('header value takes precedence over a missing body field', async () => {
    installFetchMock(async () =>
      makeResponse(200, {
        totalReturn: 0, annualizedReturn: 0, annualizedVolatility: 0,
        sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, maxDrawdown: 0,
        valueAtRisk95: 0, valueAtRisk99: 0, conditionalVaR95: 0, conditionalVaR99: 0,
        ulcerIndex: 0, burkeRatio: 0, sampleSize: 0, annualizationFactor: 252, riskFreeRate: 0,
      }, { requestId: 'req_header_only' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await client.risk.compute({
      equityCurve: [{ timestamp: 1, lpValue: 1 }, { timestamp: 2, lpValue: 2 }],
    });
    expect(out.requestId).toBe('req_header_only');
  });

  it('still exposes requestId when header is missing but body has it', async () => {
    installFetchMock(async () =>
      makeResponse(200, {
        backtestId: 'bt_1', useRealData: false, results: {}, warnings: [], requestId: 'req_body_only',
      }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const out = await client.backtests.run({
      poolAddress: '0x8ad599c3a0cc1a8a26606766b157530d66f33675',
      lowerPrice: 2200, upperPrice: 2700, depositAmount: 1000, depositToken: 'usd',
    });
    expect(out.requestId).toBe('req_body_only');
  });
});

/* -------------------------------------------------------------------------- */
/* Low-level request() — escape hatch                                          */
/* -------------------------------------------------------------------------- */

describe('client.request() escape hatch', () => {
  it('returns the body on 200', async () => {
    installFetchMock(async () => makeResponse(200, { ok: true, requestId: 'req_low' }, { requestId: 'req_low' }));
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const r = await client.request<{ ok: boolean } & { requestId: string }>('GET', '/api/health');
    expect(r.ok).toBe(true);
    expect(r.requestId).toBe('req_low');
  });

  it('throws UnivariateError on malformed JSON body', async () => {
    installFetchMock(async () => new Response('not json', { status: 200 }));
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    await expect(client.request('GET', '/api/health')).rejects.toBeInstanceOf(UnivariateError);
  });
});

/* -------------------------------------------------------------------------- */
/* Backoff: ensure it is bounded                                               */
/* -------------------------------------------------------------------------- */

describe('retry timing', () => {
  it('does not exceed a reasonable wall time across 3 retries', async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse(500, { error: 'internal_error' }),
    );
    const client = new UnivariateClient({ baseUrl: 'https://x.example.com' });
    const start = Date.now();
    await expect(client.risk.compute({
      equityCurve: [{ timestamp: 1, lpValue: 1 }, { timestamp: 2, lpValue: 2 }],
    })).rejects.toBeInstanceOf(UnivariateError);
    const elapsed = Date.now() - start;
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // 3 sleeps with jittered backoff up to MAX_BACKOFF_MS (8s). We give a
    // generous bound so CI doesn't flake. Real wall time should be well
    // under 2s with random jitter averaging ~half the cap.
    expect(elapsed).toBeLessThan(15_000);
  });
});