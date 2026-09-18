/**
 * Tests for `lib/data/covalent` — the Covalent GoldRush per-swap adapter.
 *
 * Coverage map:
 *   1.  `isCovalentEnabled` / `getCovalentApiKey` — env-gated, throws on miss
 *   2.  `covalentChainName` — maps known chains, rejects unknown
 *   3.  `fetchCovalentSwaps` — builds correct URL, paginates via has_more,
 *       validates response schema, returns typed CovalentSwap records
 *   4.  Pagination safety — `maxPages` guard throws instead of looping forever
 *   5.  Cache — repeated calls hit the cache (only one network round-trip)
 *   6.  `clearCovalentCache` — drops the cache deterministically
 *   7.  `aggregateCovalentSwapsByDay` — sums USD volume per day, skips null
 *       priced swaps, applies fee rate
 *   8.  Argument validation — invalid pool address rejected, pageSize bounds
 *   9.  Auth failure surfaces — HTTP 401 throws with a useful message
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  aggregateCovalentSwapsByDay,
  clearCovalentCache,
  covalentChainName,
  fetchCovalentSwaps,
  getCovalentApiKey,
  isCovalentEnabled,
  type CovalentSwap,
} from '../lib/data/covalent';

// ---------------------------------------------------------------------------
// Test helpers — build mock GoldRush pages, mock fetch, snapshot/restore env
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = process.env.COVALENT_API_KEY;

function makeRow(over: Partial<{
  tx_hash: string;
  block_height: number;
  block_signed_at: string;
  sender_address: string;
  amount_0: string;
  amount_1: string;
  amount_usd: number | null;
  log_offset: number;
}> = {}) {
  return {
    tx_hash: '0xabc123',
    block_height: 18_500_000,
    block_signed_at: '2026-09-17T12:00:00Z',
    sender_address: '0xrouter00000000000000000000000000000000001',
    to_address: null,
    amount_0: '-1.5',
    amount_1: '0.4',
    amount_usd: 1500.0,
    token_0: {
      contract_address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
      symbol: 'WETH',
    },
    token_1: {
      contract_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      symbol: 'USDC',
    },
    log_offset: 12,
    ...over,
  };
}

function makePage(items: Array<ReturnType<typeof makeRow>>, pageNumber: number, hasMore: boolean) {
  return {
    data: {
      address: '0xpool',
      updated_at: '2026-09-17T12:00:00Z',
      next_update_at: '2026-09-17T12:00:30Z',
      quote_currency: 'USD',
      items,
      pagination: {
        has_more: hasMore,
        page_number: pageNumber,
        page_size: 1000,
        total_count: items.length,
      },
    },
  };
}

interface MockFetchCall {
  url: string;
  pageNumber: number;
}

function makeMockFetch(plan: Array<{ items: Array<ReturnType<typeof makeRow>>; hasMore: boolean }>) {
  const calls: MockFetchCall[] = [];
  const fetchImpl = (async (url: string) => {
    const u = new URL(url);
    const pageNumber = Number(u.searchParams.get('page-number') ?? '0');
    calls.push({ url, pageNumber });
    if (pageNumber >= plan.length) {
      return new Response(JSON.stringify({ error: 'no more plan entries' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const slot = plan[pageNumber];
    const body = makePage(slot.items, pageNumber, slot.hasMore);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

beforeEach(() => {
  clearCovalentCache();
  process.env.COVALENT_API_KEY = 'ckey_test_abcdef123';
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.COVALENT_API_KEY;
  else process.env.COVALENT_API_KEY = ORIGINAL_ENV;
  clearCovalentCache();
});

// ---------------------------------------------------------------------------
// 1. env-gating
// ---------------------------------------------------------------------------

describe('env-gating', () => {
  it('isCovalentEnabled() returns false when key is missing', () => {
    delete process.env.COVALENT_API_KEY;
    expect(isCovalentEnabled()).toBe(false);
  });

  it('isCovalentEnabled() returns false when key is too short', () => {
    process.env.COVALENT_API_KEY = 'short';
    expect(isCovalentEnabled()).toBe(false);
  });

  it('isCovalentEnabled() returns true when key is long enough', () => {
    process.env.COVALENT_API_KEY = 'ckey_long_enough_1234';
    expect(isCovalentEnabled()).toBe(true);
  });

  it('getCovalentApiKey() throws with an actionable message when missing', () => {
    delete process.env.COVALENT_API_KEY;
    expect(() => getCovalentApiKey()).toThrowError(/Covalent GoldRush adapter is disabled/);
    expect(() => getCovalentApiKey()).toThrowError(/goldrush\.dev/);
  });

  it('getCovalentApiKey() returns the key when set', () => {
    process.env.COVALENT_API_KEY = 'ckey_test_abcdef123';
    expect(getCovalentApiKey()).toBe('ckey_test_abcdef123');
  });
});

// ---------------------------------------------------------------------------
// 2. chain name mapping
// ---------------------------------------------------------------------------

describe('covalentChainName', () => {
  it('maps known chain ids', () => {
    expect(covalentChainName(1)).toBe('eth-mainnet');
    expect(covalentChainName(42161)).toBe('arbitrum-mainnet');
    expect(covalentChainName(8453)).toBe('base-mainnet');
    expect(covalentChainName(10)).toBe('optimism-mainnet');
    expect(covalentChainName(137)).toBe('polygon-mainnet');
  });

  it('throws on unsupported chains with a clear message', () => {
    expect(() => covalentChainName(999)).toThrowError(/chainId=999/);
  });
});

// ---------------------------------------------------------------------------
// 3 + 9. fetchCovalentSwaps — URL building, pagination, schema, auth errors
// ---------------------------------------------------------------------------

describe('fetchCovalentSwaps', () => {
  it('builds the correct URL, paginates via has_more, returns typed records', async () => {
    const page1Row = makeRow({ tx_hash: '0x111', log_offset: 1, amount_usd: 100 });
    const page2Row = makeRow({ tx_hash: '0x222', log_offset: 2, amount_usd: 200 });
    const { fetchImpl, calls } = makeMockFetch([
      { items: [page1Row], hasMore: true },
      { items: [page2Row], hasMore: false },
    ]);

    const swaps = await fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', {
      fetchImpl,
    });

    expect(swaps).toHaveLength(2);
    expect(swaps[0].txHash).toBe('0x111');
    expect(swaps[0].amountUSD).toBe(100);
    expect(swaps[1].txHash).toBe('0x222');
    expect(calls).toHaveLength(2);
    // First URL — page-number=0, has the right base + key + page-size
    expect(calls[0].url).toContain('https://api.covalenthq.com/v1/eth-mainnet/uniswap_v3/pools/0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72/swaps/');
    expect(calls[0].url).toContain('page-number=0');
    expect(calls[0].url).toContain('page-size=1000');
    expect(calls[0].url).toContain('quote-currency=USD');
    expect(calls[0].url).toContain('key=ckey_test_abcdef123');
    expect(calls[1].pageNumber).toBe(1);
  });

  it('normalises pool address case in the URL', async () => {
    const { fetchImpl, calls } = makeMockFetch([{ items: [makeRow()], hasMore: false }]);
    await fetchCovalentSwaps(1, '0x88E6A0C2DDD26FEEB64F039A2C4122FCB7F78A72', { fetchImpl });
    expect(calls[0].url).toContain('/pools/0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72/swaps/');
  });

  it('propagates the env API key into the request URL', async () => {
    process.env.COVALENT_API_KEY = 'ckey_my_real_key_zzz';
    const { fetchImpl, calls } = makeMockFetch([{ items: [makeRow()], hasMore: false }]);
    await fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', { fetchImpl });
    expect(calls[0].url).toContain('key=ckey_my_real_key_zzz');
  });

  it('throws on a 401 with the response body attached', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error_message: 'invalid api key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;
    await expect(
      fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', { fetchImpl }),
    ).rejects.toThrowError(/Covalent HTTP 401/);
    await expect(
      fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', { fetchImpl }),
    ).rejects.toThrowError(/invalid api key/);
  });

  it('throws on a malformed JSON payload (schema validation)', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: { items: 'not-an-array' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;
    await expect(
      fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', { fetchImpl }),
    ).rejects.toThrowError(/schema validation/);
  });

  it('translates ISO timestamps into unix ms', async () => {
    const { fetchImpl } = makeMockFetch([
      { items: [makeRow({ block_signed_at: '2026-09-17T00:00:00Z' })], hasMore: false },
    ]);
    const [swap] = await fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', { fetchImpl });
    expect(swap.timestampMs).toBe(Date.parse('2026-09-17T00:00:00Z'));
  });
});

// ---------------------------------------------------------------------------
// 4. maxPages safety
// ---------------------------------------------------------------------------

describe('fetchCovalentSwaps pagination safety', () => {
  it('throws when has_more never goes false within maxPages', async () => {
    // Every page reports has_more=true so we never converge.
    const { fetchImpl } = makeMockFetch([
      { items: [makeRow()], hasMore: true },
      { items: [makeRow()], hasMore: true },
      { items: [makeRow()], hasMore: true },
    ]);
    await expect(
      fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', {
        fetchImpl,
        maxPages: 2,
      }),
    ).rejects.toThrowError(/pagination exceeded maxPages=2/);
  });

  it('rejects pageSize out of bounds', async () => {
    const { fetchImpl } = makeMockFetch([{ items: [], hasMore: false }]);
    await expect(
      fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', {
        fetchImpl,
        pageSize: 5000,
      }),
    ).rejects.toThrowError(/pageSize must be between 1 and 1000/);
  });
});

// ---------------------------------------------------------------------------
// 5 + 6. caching
// ---------------------------------------------------------------------------

describe('fetchCovalentSwaps caching', () => {
  it('caches results — repeated calls do not re-fetch', async () => {
    const { fetchImpl, calls } = makeMockFetch([
      { items: [makeRow({ tx_hash: '0xa' })], hasMore: false },
    ]);
    const addr = '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72';
    const a = await fetchCovalentSwaps(1, addr, { fetchImpl });
    const b = await fetchCovalentSwaps(1, addr, { fetchImpl });
    expect(a).toBe(b); // same reference => cache hit
    expect(calls).toHaveLength(1);
  });

  it('different (chain, pool, window) keys do not collide', async () => {
    const { fetchImpl, calls } = makeMockFetch([
      { items: [makeRow({ tx_hash: '0xa' })], hasMore: false },
      { items: [makeRow({ tx_hash: '0xb' })], hasMore: false },
    ]);
    await fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', { fetchImpl });
    await fetchCovalentSwaps(
      1,
      '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72',
      { fetchImpl, startTime: new Date('2026-09-01T00:00:00Z') },
    );
    expect(calls).toHaveLength(2);
  });

  it('clearCovalentCache drops entries so the next call re-fetches', async () => {
    const { fetchImpl, calls } = makeMockFetch([
      { items: [makeRow()], hasMore: false },
      { items: [makeRow()], hasMore: false },
    ]);
    const addr = '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72';
    await fetchCovalentSwaps(1, addr, { fetchImpl });
    clearCovalentCache();
    await fetchCovalentSwaps(1, addr, { fetchImpl });
    expect(calls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 8. argument validation
// ---------------------------------------------------------------------------

describe('fetchCovalentSwaps argument validation', () => {
  it('rejects a non-address pool argument', async () => {
    await expect(fetchCovalentSwaps(1, 'not-an-address')).rejects.toThrowError(/Invalid pool address/);
  });

  it('throws when COVALENT_API_KEY is not set', async () => {
    delete process.env.COVALENT_API_KEY;
    await expect(
      fetchCovalentSwaps(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72'),
    ).rejects.toThrowError(/COVALENT_API_KEY/);
  });
});

// ---------------------------------------------------------------------------
// 7. aggregateCovalentSwapsByDay
// ---------------------------------------------------------------------------

describe('aggregateCovalentSwapsByDay', () => {
  function iso(day: string, time: string): string {
    return `${day}T${time}Z`;
  }
  function swap(day: string, time: string, usd: number | null, hash = '0x'): CovalentSwap {
    return {
      txHash: hash,
      blockHeight: 18_500_000,
      timestampISO: iso(day, time),
      timestampMs: Date.parse(iso(day, time)),
      sender: '0xsender',
      amount0: '1',
      amount1: '0.5',
      amountUSD: usd,
      token0Address: '0xaaaa',
      token1Address: '0xbbbb',
      logOffset: 0,
    };
  }

  it('sums per-day USD volume, applies fee rate, counts swaps', () => {
    const swaps: CovalentSwap[] = [
      swap('2026-09-15', '08:00:00', 100, '0x1'),
      swap('2026-09-15', '20:00:00', 50, '0x2'),
      swap('2026-09-16', '12:00:00', 200, '0x3'),
    ];
    const out = aggregateCovalentSwapsByDay(swaps, 0.003);
    expect(out.totalVolumeUSD).toBe(350);
    expect(out.totalSwapCount).toBe(3);
    expect(out.nullCount).toBe(0);
    const day15 = Math.floor(Date.parse('2026-09-15T00:00:00Z') / 86_400_000) * 86_400_000;
    const day16 = Math.floor(Date.parse('2026-09-16T00:00:00Z') / 86_400_000) * 86_400_000;
    const b15 = out.byDay.get(day15);
    const b16 = out.byDay.get(day16);
    expect(b15?.volumeUSD).toBe(150);
    expect(b15?.dailyFeesUsd).toBeCloseTo(0.45);
    expect(b15?.swapCount).toBe(2);
    expect(b16?.volumeUSD).toBe(200);
    expect(b16?.dailyFeesUsd).toBeCloseTo(0.6);
  });

  it('skips null-USD rows and surfaces the count', () => {
    const swaps: CovalentSwap[] = [
      swap('2026-09-15', '00:00:00', 100),
      swap('2026-09-15', '06:00:00', null),
      swap('2026-09-15', '12:00:00', 50),
    ];
    const out = aggregateCovalentSwapsByDay(swaps, 0.0005);
    expect(out.nullCount).toBe(1);
    expect(out.totalSwapCount).toBe(2);
    expect(out.totalVolumeUSD).toBe(150);
  });

  it('returns an empty map for an empty input', () => {
    const out = aggregateCovalentSwapsByDay([], 0.003);
    expect(out.byDay.size).toBe(0);
    expect(out.totalSwapCount).toBe(0);
    expect(out.totalVolumeUSD).toBe(0);
    expect(out.nullCount).toBe(0);
  });
});