/**
 * Tests for the real-data backtest data layer + engine.
 *
 * Covers:
 *   1. `fetchPoolHistoricalData` rejects on invalid chainId / poolAddress / days
 *   2. `fetchPoolHistoricalData` returns the expected shape when DeFiLlama +
 *      CoinGecko are mocked
 *   3. `runRealBacktest` calls `runBacktest` with the correct shape
 *   4. The modeled path is taken when CoinGecko returns 404 / empty data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ----- Internal modules under test -----
import {
  fetchPoolHistoricalData,
  HistoricalDataError,
} from '../lib/data/historical';
import { runRealBacktest } from '../lib/simulation/backtest-real';
import type { BacktestResult } from '../lib/simulation/backtest';

// ----- Mocked collaborators -----
const getPoolMetricsMock = vi.fn();
const getPoolDataMock = vi.fn();
const getCoinGeckoIdAutoMock = vi.fn();

vi.mock('../lib/data/defillama', async () => {
  const actual = await vi.importActual<typeof import('../lib/data/defillama')>(
    '../lib/data/defillama',
  );
  return {
    ...actual,
    getPoolMetrics: (...args: unknown[]) => getPoolMetricsMock(...args),
  };
});
vi.mock('../lib/data/rpc', async () => {
  const actual = await vi.importActual<typeof import('../lib/data/rpc')>(
    '../lib/data/rpc',
  );
  return {
    ...actual,
    fetchPoolData: (...args: unknown[]) => getPoolDataMock(...args),
  };
});
vi.mock('../lib/data/coingecko', async () => {
  const actual = await vi.importActual<typeof import('../lib/data/coingecko')>(
    '../lib/data/coingecko',
  );
  return {
    ...actual,
    getCoinGeckoIdAuto: (...args: unknown[]) => getCoinGeckoIdAutoMock(...args),
  };
});

// Reset caches + spies between tests so TTL/state from one test doesn't leak.
import { invalidate } from '../lib/api/cache';
import { clearDefiLlamaCache } from '../lib/data/defillama';

beforeEach(() => {
  invalidate('coingecko-prices');
  clearDefiLlamaCache();
  getPoolMetricsMock.mockReset();
  getPoolDataMock.mockReset();
  getCoinGeckoIdAutoMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// (1) Input validation
// =============================================================================
describe('fetchPoolHistoricalData — input validation', () => {
  it('rejects an unsupported chainId', async () => {
    await expect(
      fetchPoolHistoricalData(
        999999,
        '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4' as `0x${string}`,
        30,
      ),
    ).rejects.toThrow(/Unsupported chainId|HistoricalDataError/);
  });

  it('rejects an invalid poolAddress', async () => {
    await expect(
      fetchPoolHistoricalData(1, 'not-an-address' as `0x${string}`, 30),
    ).rejects.toThrow(/Invalid poolAddress/);
  });

  it('rejects days outside 1..365', async () => {
    await expect(
      fetchPoolHistoricalData(
        1,
        '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4' as `0x${string}`,
        0,
      ),
    ).rejects.toThrow(/Invalid days/);
    await expect(
      fetchPoolHistoricalData(
        1,
        '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4' as `0x${string}`,
        366,
      ),
    ).rejects.toThrow(/Invalid days/);
    await expect(
      fetchPoolHistoricalData(
        1,
        '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4' as `0x${string}`,
        1.5,
      ),
    ).rejects.toThrow(/Invalid days/);
  });
});

// =============================================================================
// (2) Happy path: DeFiLlama + CoinGecko mocked
// =============================================================================
describe('fetchPoolHistoricalData — happy path', () => {
  it('returns the expected HistoricalPoolData shape', async () => {
    // ---- Stub on-chain pool resolution ----
    getPoolDataMock.mockResolvedValueOnce({
      chainId: 1,
      address: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4',
      token0: {
        chainId: 1,
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
      token1: {
        chainId: 1,
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
      },
      feeTier: 3000,
      tickSpacing: 60,
      currentTick: -190000,
      currentSqrtPriceX96: '1771595571149237100000000000000000',
      currentLiquidity: '1000000000000000000',
    });
    // Map both tokens to CoinGecko IDs
    getCoinGeckoIdAutoMock.mockImplementation(async (addr: string) => {
      if (addr.toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') {
        return 'usd-coin';
      }
      if (addr.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
        return 'weth';
      }
      return null;
    });

    // ---- Stub DeFiLlama volume lookup ----
    getPoolMetricsMock.mockResolvedValueOnce({
      tvlUsd: 25_000_000,
      volumeUsd1d: 12_000_000,
      volumeUsd7d: 80_000_000,
      apy: 0.18,
      apyBase: 0.12,
    });

    // ---- Stub global fetch for CoinGecko market_chart ----
    // Each token returns 5 days of [ts, price] pairs (millisecond timestamps).
    const nowMs = Date.now();
    const day = 86_400_000;
    const stubFetch = vi
      .spyOn(global, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('api.llama.fi')) {
          // Should never be hit directly here — volume goes via getPoolMetrics.
          return new Response('{}', { status: 200 });
        }
        if (url.includes('coins/usd-coin/market_chart')) {
          return new Response(
            JSON.stringify({
              prices: [
                [nowMs - 4 * day, 1.0001],
                [nowMs - 3 * day, 1.0002],
                [nowMs - 2 * day, 1.0003],
                [nowMs - 1 * day, 1.0004],
                [nowMs, 1.0005],
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.includes('coins/weth/market_chart')) {
          return new Response(
            JSON.stringify({
              prices: [
                [nowMs - 4 * day, 2400],
                [nowMs - 3 * day, 2450],
                [nowMs - 2 * day, 2500],
                [nowMs - 1 * day, 2480],
                [nowMs, 2520],
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 404 });
      });

    const out = await fetchPoolHistoricalData(
      1,
      '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4' as `0x${string}`,
      5,
    );

    // ----- Shape assertions -----
    expect(out.chainId).toBe(1);
    expect(out.poolAddress.toLowerCase()).toBe(
      '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4',
    );
    expect(out.token0.symbol).toBe('USDC');
    expect(out.token1.symbol).toBe('WETH');
    expect(out.token0.decimals).toBe(6);
    expect(out.token1.decimals).toBe(18);
    expect(out.feeTier).toBe(3000);
    expect(out.source).toBe('defillama+coingecko');
    expect(out.points.length).toBeGreaterThan(0);
    // points are PriceDataPoint = { timestamp, price, volumeUSD }
    for (const p of out.points) {
      expect(typeof p.timestamp).toBe('number');
      expect(typeof p.price).toBe('number');
      expect(typeof p.volumeUSD).toBe('number');
    }

    // expectations on fetch spy
    expect(stubFetch).toHaveBeenCalled();
    // first CoinGecko call — verify URL
    const calledUrls = stubFetch.mock.calls.map(
      (c) => (typeof c[0] === 'string' ? c[0] : (c[0] as URL).toString()) as string,
    );
    expect(
      calledUrls.some(
        (u) => u.includes('coins/usd-coin/market_chart'),
      ),
    ).toBe(true);
    expect(
      calledUrls.some((u) => u.includes('coins/weth/market_chart')),
    ).toBe(true);
  });
});

// =============================================================================
// (3) runRealBacktest glue — calls runBacktest with the right shape
// =============================================================================
describe('runRealBacktest — delegation to runBacktest', () => {
  it('calls runBacktest with the mapped BacktestParams', async () => {
    // Stub the data layer to bypass RPC/network.
    const historicalModule = await import('../lib/data/historical');
    const nowSec = Math.floor(Date.now() / 1000);
    // Use prices near 1.0 — `lib/univ3/math.ts` has a pre-existing
    // division-by-zero in `tickToSqrtPriceX96` once tick magnitude gets
    // large (around price ≈ 2000). Out of scope here.
    const points = Array.from({ length: 8 }, (_, i) => ({
      timestamp: nowSec - (7 - i) * 86_400,
      price: 0.95 + i * 0.02,
      volumeUSD: 1_000_000 + i * 100_000,
    }));
    const spyFetch = vi
      .spyOn(historicalModule, 'fetchPoolHistoricalData')
      .mockResolvedValueOnce({
        chainId: 1,
        poolAddress: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4',
        token0: {
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          symbol: 'USDC',
          decimals: 6,
          coingeckoId: 'usd-coin',
        },
        token1: {
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          symbol: 'WETH',
          decimals: 18,
          coingeckoId: 'weth',
        },
        feeTier: 3000,
        points,
        source: 'defillama+coingecko',
        warnings: [],
      });

    const backtestModule = await import('../lib/simulation/backtest');
    // We do NOT want to actually invoke `runBacktest` here — the existing
    // `lib/univ3/math.ts` `tickToSqrtPriceX96` implementation has a
    // division-by-zero for many tick magnitudes (out of scope to fix here).
    // The purpose of this test is to verify `runRealBacktest` dispatches with
    // the correct mapped BacktestParams shape, which we capture below.
    const spyRun = vi
      .spyOn(backtestModule, 'runBacktest')
      .mockImplementation((p) => ({
        totalReturn: 0,
        hodlReturn: 0,
        excessReturn: 0,
        totalFees: 0,
        realizedIL: 0,
        gasCosts: 0,
        rebalanceCount: 0,
        timeInRange: 0,
        periodsOutOfRange: 0,
        equityCurve: [],
        drawdowns: [],
        bestWindow: { start: 0, end: 0, return: 0 },
        worstWindow: { start: 0, end: 0, return: 0 },
        // expose the input for shape verification
        _params: p,
      }) as unknown as BacktestResult);

    // Use a price range centred on 1.0 to match the tick range used by the
    // existing v4-simulation tests; large ticks trigger a separate pre-existing
    // math.ts edge-case that is out of scope here.
    const result = await runRealBacktest({
      chainId: 1,
      poolAddress: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4' as `0x${string}`,
      lowerPrice: 0.95,
      upperPrice: 1.05,
      depositAmount: 10_000,
      depositToken: 'usd',
      rebalanceMode: 'threshold',
      rebalanceParams: { priceThreshold: 0.15 },
      gasCostGwei: 20,
      gasUnitsPerRebalance: 250_000,
      token0Decimals: 6,
      token1Decimals: 18,
      feeTier: 3000,
      days: 7,
    });

    expect(spyFetch).toHaveBeenCalledWith(
      1,
      '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4',
      7,
    );
    expect(spyRun).toHaveBeenCalledTimes(1);
    const callArgs = spyRun.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs!.entryTimestamp).toBe(points[0].timestamp);
    expect(callArgs!.lowerPrice).toBe(0.95);
    expect(callArgs!.upperPrice).toBe(1.05);
    expect(callArgs!.depositAmount).toBe(10_000);
    expect(callArgs!.depositToken).toBe('usd');
    expect(callArgs!.rebalanceMode).toBe('threshold');
    expect(callArgs!.rebalanceParams?.priceThreshold).toBe(0.15);
    expect(callArgs!.gasCostGwei).toBe(20);
    expect(callArgs!.gasUnitsPerRebalance).toBe(250_000);
    expect(callArgs!.token0Decimals).toBe(6);
    expect(callArgs!.token1Decimals).toBe(18);
    // V3 feeTier 3000 (0.3% pool) is normalised to 30 for the engine's
    // `dailyFeeRate = feeTier / 10000` convention.
    expect(callArgs!.feeTier).toBe(30);
    expect(callArgs!.priceHistory).toHaveLength(8);

    // Wrapped result shape
    expect(result.dataSource).toBe('defillama+coingecko');
    expect(result.dataPointsUsed).toBe(8);
    expect(typeof result.fetchTimestamp).toBe('string');
    // Should be parseable ISO.
    expect(Number.isFinite(Date.parse(result.fetchTimestamp))).toBe(true);
  });

  it('surfaces NOT_FOUND from the data layer as HistoricalDataError(NOT_FOUND)', async () => {
    const historicalModule = await import('../lib/data/historical');
    vi.spyOn(historicalModule, 'fetchPoolHistoricalData').mockRejectedValueOnce(
      new HistoricalDataError(
        'NOT_FOUND',
        'Pool 0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4 is not indexed by DeFi Llama; cannot source volume history.',
      ),
    );

    await expect(
      runRealBacktest({
        chainId: 1,
        poolAddress: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4' as `0x${string}`,
        lowerPrice: 0.95,
        upperPrice: 1.05,
        depositAmount: 10_000,
        depositToken: 'usd',
        rebalanceMode: 'none',
        gasCostGwei: 20,
        gasUnitsPerRebalance: 250_000,
        token0Decimals: 6,
        token1Decimals: 18,
        feeTier: 3000,
        days: 7,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// =============================================================================
// (4) Modeled path — CoinGecko returns 404 / empty data
// =============================================================================
describe('fetchPoolHistoricalData — modeled fallback', () => {
  it('falls back to modeled path when CoinGecko returns 404', async () => {
    // Pool on-chain resolution
    getPoolDataMock.mockResolvedValueOnce({
      chainId: 1,
      address: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4',
      token0: {
        chainId: 1,
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        symbol: 'X',
        name: 'Mystery Token',
        decimals: 18,
      },
      token1: {
        chainId: 1,
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
      },
      feeTier: 3000,
      tickSpacing: 60,
      currentTick: -190500,
      currentSqrtPriceX96: '1771595571149237100000000000000000',
      currentLiquidity: '1000000000000000000',
    });
    // Token0 has no CoinGecko ID; token1 does.
    getCoinGeckoIdAutoMock.mockImplementation(async (addr: string) => {
      return addr.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        ? 'weth'
        : null;
    });

    // DeFiLlama has the pool + volume
    getPoolMetricsMock.mockResolvedValueOnce({
      tvlUsd: 5_000_000,
      volumeUsd1d: 2_000_000,
      volumeUsd7d: 14_000_000,
      apy: 0.25,
    });

    // CoinGecko returns 404 for token0 (unknown) and 200 (with empty prices[]) for token1
    vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.llama.fi')) {
        return new Response('{}', { status: 200 });
      }
      // empty prices — not present token
      if (url.includes('api.coingecko.com')) {
        return new Response(
          JSON.stringify({ prices: [] }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    });

    const out = await fetchPoolHistoricalData(
      1,
      '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d4' as `0x${string}`,
      30,
    );

    expect(out.source).toBe('defillama+modeled');
    expect(out.points.length).toBeGreaterThan(0);
    // Must include the modeled warning string.
    expect(
      out.warnings.some((w) => w.includes('modeled price path used')),
    ).toBe(true);
  });
});
