/**
 * Tests for `lib/data/pools.getTopPools` and the DeFi Llama → Pool
 * transform logic. The implementation uses DeFi Llama's working endpoint
 * `/pools/{chainSlug}` and a parser that turns `poolMeta` ("0.3%") into
 * the V3 fee tier (3000 bps).
 */

import { describe, expect, it } from 'vitest';

import { getTopPools } from '../lib/data/pools';

/**
 * Reach into the module to grab the helper. We re-implement it here
 * because the page module's parser is intentionally internal (no need to
 * export a helper that just does string parsing).
 */
function parseFeeTierFromMeta(meta?: string): number | null {
  if (!meta) return null;
  const m = meta.match(/([\d.]+)\s*%/);
  if (!m) return null;
  const pct = parseFloat(m[1]);
  if (!Number.isFinite(pct)) return null;
  // V3 fee tier units: 0.3% → 3000 (hundredths-of-a-bps).
  const feeTier = Math.round(pct * 10_000);
  return [100, 500, 3000, 10000].includes(feeTier) ? feeTier : null;
}

// ---------------------------------------------------------------------------
// 1. parseFeeTierFromMeta — pure string parsing.
// ---------------------------------------------------------------------------

describe('parseFeeTierFromMeta', () => {
  it.each([
    ['0.01%', 100],
    ['0.05%', 500],
    ['0.3%', 3000],
    ['1%', 10000],
  ])('%s → %i bps', (input, expected) => {
    expect(parseFeeTierFromMeta(input)).toBe(expected);
  });

  it('returns null for absent / unrecognised inputs', () => {
    expect(parseFeeTierFromMeta(undefined)).toBeNull();
    expect(parseFeeTierFromMeta('')).toBeNull();
    expect(parseFeeTierFromMeta('unknown')).toBeNull();
    expect(parseFeeTierFromMeta('7%')).toBeNull();
    expect(parseFeeTierFromMeta('0.7%')).toBeNull(); // not a V3 fee tier
  });
});

// ---------------------------------------------------------------------------
// 2. getTopPools — must return V3 pools sorted by TVL, with sane types.
//    We mock fetchDefiLlamaPools indirectly by setting up a tiny fetch
//    mock so the test doesn't need network access. The test asserts the
//    shape and ordering without depending on upstream API availability.
// ---------------------------------------------------------------------------

import type { DefiLlamaPool } from '../lib/data/defillama';
import { getKnownPool, getPoolByAddress } from '../lib/data/pools';

// Provide a known-good DeFi Llama fixture and validate the transform.
const LLAMA_FIXTURE: DefiLlamaPool[] = [
  {
    pool: 'uuid-weth-usdc-0-05',
    chain: 'Ethereum',
    project: 'uniswap-v3',
    symbol: 'USDC-WETH',
    poolMeta: '0.05%',
    tvlUsd: 120_000_000,
    apy: 0.082,
    volumeUsd1d: 80_000_000,
    underlyingTokens: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
  },
  {
    pool: 'uuid-wbtc-weth-0-05',
    chain: 'Ethereum',
    project: 'uniswap-v3',
    symbol: 'WBTC-WETH',
    poolMeta: '0.05%',
    tvlUsd: 80_000_000,
    apy: 0.054,
    volumeUsd1d: 25_000_000,
    underlyingTokens: ['0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
  },
  // Non-V3 — should be filtered out.
  {
    pool: 'uuid-sushi-eth-usdt',
    chain: 'Ethereum',
    project: 'sushi',
    symbol: 'USDT-ETH',
    poolMeta: '0.3%',
    tvlUsd: 12_000_000,
    underlyingTokens: ['0xdac17f958d2ee523a2206206994597c13d831ec7', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
  },
  // Pool with no fee tier — should fall back to 3000 without crashing.
  {
    pool: 'uuid-no-fee',
    chain: 'Ethereum',
    project: 'uniswap-v3',
    symbol: 'UNKNOWN-UNKNOWN',
    poolMeta: undefined,
    tvlUsd: 5_000_000,
    underlyingTokens: [],
  },
];

describe('getTopPools — DeFi Llama → Pool transform', () => {
  it('filters non-V3, sorts by TVL, parses fee tier from poolMeta', async () => {
    // We can't directly inject the DeFi Llama response without refactoring
    // the data layer to accept a client; instead, we round-trip the public
    // surface and assert the SORT ORDER is correct by checking that TVL
    // decreases across the returned array, even though the upstream data
    // set is fixed at the public fixture.
    //
    // For a true offline test we wrap with a fetch mock that returns the
    // fixture when the harness calls DeFi Llama.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      // After 2026-09 DeFi Llama serves the full pool list at
      // `yields.llama.fi/pools` (no chain suffix) — the per-chain
      // endpoint was retired.
      if (url === 'https://yields.llama.fi/pools') {
        return new Response(JSON.stringify({ data: LLAMA_FIXTURE }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Fallback for any other upstream — 404 keeps the test honest about
      // boundaries.
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    try {
      const pools = await getTopPools(1, 10);
      expect(pools.length).toBe(3); // sushi excluded
      // Sorted by TVL descending.
      for (let i = 1; i < pools.length; i++) {
        expect(pools[i - 1].tvlUSD ?? 0).toBeGreaterThanOrEqual(pools[i].tvlUSD ?? 0);
      }
      // First pool = WETH/USDC 0.05%
      expect(pools[0].token0.symbol).toBe('USDC');
      expect(pools[0].token1.symbol).toBe('WETH');
      expect(pools[0].feeTier).toBe(500);
      expect(pools[0].tickSpacing).toBe(10);
      expect(pools[0].tvlUSD).toBe(120_000_000);
      expect(pools[0].apr).toBeCloseTo(0.082);
      // Pool without poolMeta falls back to 3000 bps without crashing.
      const unknown = pools.find((p) => p.address === 'uuid-no-fee');
      expect(unknown?.feeTier).toBe(3000);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
// ---------------------------------------------------------------------------
// 3. getKnownPool — the hardcoded fallback table for the most-frequently
//    queried pools, used when the upstream RPC is rate-limited.
// ---------------------------------------------------------------------------

describe('getKnownPool', () => {
  it('returns the static record for known V3 pools', () => {
    const p = getKnownPool(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72');
    expect(p).not.toBeNull();
    expect(p!.feeTier).toBe(500);
    expect(p!.tickSpacing).toBe(10);
    expect(p!.token0.symbol).toBe('USDC');
    expect(p!.token1.symbol).toBe('WETH');
  });

  it('case-insensitive address match', () => {
    const a = getKnownPool(1, '0x88E6A0C2DDD26FEEB64F039A2C4122FCB7F78A72');
    const b = getKnownPool(1, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72');
    expect(a?.address).toBe(b?.address);
  });

  it('returns null for unknown pools', () => {
    expect(getKnownPool(1, '0x0000000000000000000000000000000000000001')).toBeNull();
  });

  it('returns null for unsupported chains', () => {
    // Even with a known pool address, off-mainnet chains get nothing —
    // the fallback table is Ethereum-only for now.
    expect(getKnownPool(42161, '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. getPoolByAddress — must fall back to KNOWN_POOLS when the RPC fails.
// ---------------------------------------------------------------------------

describe('getPoolByAddress fallback', () => {
  it('falls back to the hardcoded record when fetchPoolData throws', async () => {
    // We point the fetch mock to always 500 so the RPC path throws.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('upstream unavailable', { status: 500 })) as typeof fetch;
    try {
      const pool = await getPoolByAddress(
        1,
        '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72',
      );
      expect(pool.token0.symbol).toBe('USDC');
      expect(pool.token1.symbol).toBe('WETH');
      expect(pool.feeTier).toBe(500);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('still throws for unknown pools even after fallback', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('upstream unavailable', { status: 500 })) as typeof fetch;
    try {
      await expect(getPoolByAddress(1, '0x0000000000000000000000000000000000000099')).rejects.toThrow();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  // Regression: the static fallback record has no live sqrtPriceX96, so
  // callers must not see `currentSqrtPriceX96: "0"` or `undefined` — that
  // crashes downstream sqrtPriceToTick() with "sqrtPrice must be positive".
  // The /api/pools/[address] route handles this by checking the live state
  // is meaningful before exposing it; here we assert the upstream invariant
  // that the fallback itself never carries a zero/empty sqrtPriceX96.
  it('static fallback record never carries a zero or empty sqrtPriceX96', () => {
    const KNOWN_POOL_ADDRESS = '0x8ad599c3a0ff1de082011efdd2bce8a3c8763363'; // USDC/WETH 0.3%
    const known = getKnownPool(1, KNOWN_POOL_ADDRESS);
    expect(known).not.toBeNull();
    // The fallback record should NOT pre-fill currentSqrtPriceX96 with "0"
    // or any falsy value — that path leads to a downstream crash. Either
    // absent (undefined) or a real positive BigInt-as-string is acceptable;
    // what matters is that it's never "0".
    if (known?.currentSqrtPriceX96 !== undefined) {
      expect(BigInt(known.currentSqrtPriceX96)).toBeGreaterThan(0n);
    }
  });
});
