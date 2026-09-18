/**
 * Covalent GoldRush API Client (per-swap V3 data).
 *
 * This module fetches per-swap records from a single Uniswap V3 pool via the
 * Covalent "GoldRush" unified API. The endpoint that matters here is
 *   GET https://api.covalenthq.com/v1/{chain_name}/uniswap_v3/pools/{addr}/swaps/
 * which returns every swap on the pool within the requested window, with
 * `amount_usd` already denominated in USD. That lets the north-star harness
 * replace its back-derived "daily volume ≈ dailyFees / feeRate" approximation
 * with the actual swap stream — the exact lever that was leaving the harness
 * at 0/15 pools within ±20% relative error before the V3 math fix.
 *
 * Behavior:
 *   - Disabled by default. `getCovalentApiKey()` throws unless
 *     `process.env.COVALENT_API_KEY` is set to a non-trivial key (length ≥ 8).
 *     Sign up free at https://goldrush.dev/ (no credit card).
 *   - One in-memory cache per (chain, pool, window) tuple; capped at
 *     `COVALENT_CACHE_LIMIT` entries with LRU eviction. Swap records are
 *     immutable on-chain so the cache TTL is effectively infinite.
 *   - Pagination is handled internally; `maxPages` guards runaway fetches.
 *
 * Rate limits (GoldRush free tier, ~2026):
 *   - 10 requests/second per key across all endpoints
 *   - 100,000 credits/month (one credit per page returned)
 *   - For a 30-day window on a moderately active pool we use 1–2 pages.
 *
 * No mocks. No fallbacks. Throws on hard failure.
 */

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Chain name mapping — Covalent uses kebab-case chain names that differ from
// the rest of the project. Keep this list tight: any chain not in the map
// is rejected with a clear error.
// ----------------------------------------------------------------------------

const COVALENT_CHAIN_NAMES: Record<number, string> = {
  1: 'eth-mainnet',
  42161: 'arbitrum-mainnet',
  8453: 'base-mainnet',
  10: 'optimism-mainnet',
  137: 'polygon-mainnet',
};

/** Convert an internal chain id to a Covalent chain slug. */
export function covalentChainName(chainId: number): string {
  const name = COVALENT_CHAIN_NAMES[chainId];
  if (!name) {
    throw new Error(
      `Covalent GoldRush does not support chainId=${chainId}. ` +
        `Supported: ${Object.keys(COVALENT_CHAIN_NAMES).join(', ')}`,
    );
  }
  return name;
}

// ----------------------------------------------------------------------------
// API key resolution — env-gated, never accepts a key via function arg so the
// key never accidentally flows through a logged request body or thrown error.
// ----------------------------------------------------------------------------

const MIN_KEY_LENGTH = 8;

/**
 * Returns the configured Covalent API key or throws with an actionable
 * message. Never returns an empty string.
 */
export function getCovalentApiKey(): string {
  const key = process.env.COVALENT_API_KEY;
  if (!key || key.trim().length < MIN_KEY_LENGTH) {
    throw new Error(
      'Covalent GoldRush adapter is disabled: process.env.COVALENT_API_KEY is not set ' +
        '(or shorter than 8 chars). Sign up free at https://goldrush.dev/ to obtain a key, ' +
        'then export COVALENT_API_KEY=ckey_xxx and re-run. Without a key the harness ' +
        'falls back to the DeFi Llama / Binance public endpoints.',
    );
  }
  return key;
}

/** Lightweight probe — does not throw. Use this for capability gating. */
export function isCovalentEnabled(): boolean {
  const key = process.env.COVALENT_API_KEY;
  return typeof key === 'string' && key.trim().length >= MIN_KEY_LENGTH;
}

// ----------------------------------------------------------------------------
// Response schema — narrow, defensive. We only decode fields we actually use;
// the rest of the GoldRush payload is preserved verbatim on the raw row but
// never trusted for typing.
// ----------------------------------------------------------------------------

const CovalentTokenSchema = z.object({
  contract_address: z.string(),
  decimals: z.number().int().nonnegative(),
  symbol: z.string().nullable().optional(),
}).passthrough();

const CovalentSwapRowSchema = z.object({
  tx_hash: z.string(),
  block_height: z.number().int().nonnegative(),
  block_signed_at: z.string(),
  sender_address: z.string(),
  to_address: z.string().nullable().optional(),
  // `amount_0` / `amount_1` are signed decimal-encoded strings. Negative
  // means the pool sent the token out, positive means the pool received it.
  amount_0: z.string(),
  amount_1: z.string(),
  // Covalent reports the notional USD size of the swap (sum of both legs).
  // Null when the router could not price one of the legs — rare, but possible
  // for brand-new tokens. We drop null-USD rows on the caller side.
  amount_usd: z.number().nullable(),
  token_0: CovalentTokenSchema,
  token_1: CovalentTokenSchema,
  log_offset: z.number().int().nonnegative(),
}).passthrough();

const CovalentResponseSchema = z.object({
  data: z.object({
    address: z.string(),
    updated_at: z.string().nullable().optional(),
    next_update_at: z.string().nullable().optional(),
    quote_currency: z.string().optional(),
    items: z.array(CovalentSwapRowSchema),
    pagination: z.object({
      has_more: z.boolean(),
      page_number: z.number().int().nonnegative(),
      page_size: z.number().int().positive(),
      total_count: z.number().int().nonnegative().nullable().optional(),
    }),
  }),
}).passthrough();

export interface CovalentSwap {
  txHash: string;
  blockHeight: number;
  /** ISO-8601 timestamp from the chain (block_signed_at). */
  timestampISO: string;
  /** Unix milliseconds, derived from timestampISO for fast bucketing. */
  timestampMs: number;
  sender: string;
  amount0: string;
  amount1: string;
  /** Notional USD size of the swap, or null if Covalent could not price it. */
  amountUSD: number | null;
  token0Address: string;
  token1Address: string;
  logOffset: number;
}

// ----------------------------------------------------------------------------
// Cache — small LRU on swap fetches. Swap records are immutable on-chain so
// the effective TTL is infinite; we still expose a max-age for symmetry with
// the rest of `lib/data` and to make cache invalidation easy in tests.
// ----------------------------------------------------------------------------

const COVALENT_CACHE_LIMIT = 64;
const COVALENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  swaps: CovalentSwap[];
}

const cache: Map<string, CacheEntry> = new Map();

function cacheKey(
  chainId: number,
  poolAddress: string,
  startTime: Date | undefined,
  endTime: Date | undefined,
): string {
  return [
    chainId,
    poolAddress.toLowerCase(),
    startTime ? startTime.toISOString() : '*',
    endTime ? endTime.toISOString() : '*',
  ].join('|');
}

function cacheGet(key: string): CovalentSwap[] | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > COVALENT_CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  // LRU touch
  cache.delete(key);
  cache.set(key, entry);
  return entry.swaps;
}

function cachePut(key: string, swaps: CovalentSwap[]): void {
  if (cache.size >= COVALENT_CACHE_LIMIT) {
    // Delete oldest insertion — Map preserves insertion order.
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { fetchedAt: Date.now(), swaps });
}

/** Drop every cached swap response. Intended for tests and admin tools. */
export function clearCovalentCache(): void {
  cache.clear();
}

// ----------------------------------------------------------------------------
// Pagination — GoldRush caps page_size at 1000 and exposes `pagination.has_more`.
// We iterate until exhausted or `maxPages` is reached, whichever comes first.
// ----------------------------------------------------------------------------

export interface FetchCovalentSwapsOptions {
  /** Inclusive lower bound on `block_signed_at`. Defaults to 30 days ago. */
  startTime?: Date;
  /** Exclusive upper bound on `block_signed_at`. Defaults to now. */
  endTime?: Date;
  /** Per-page size (≤ 1000). Defaults to 1000. */
  pageSize?: number;
  /** Pagination safety cap. Defaults to 25 (≈ 25,000 swaps returned max). */
  maxPages?: number;
  /** Override the default fetch (used by tests). Should accept a URL. */
  fetchImpl?: typeof fetch;
  /** Override the API key (used by tests). Falls back to env when absent. */
  apiKeyOverride?: string;
}

const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_PAGES = 25;
const REQUEST_TIMEOUT_MS = 20_000;

interface RawPage {
  items: Array<z.infer<typeof CovalentSwapRowSchema>>;
  hasMore: boolean;
}

async function fetchPage(
  url: string,
  fetchImpl: typeof fetch,
): Promise<RawPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      // Try to surface a useful error message; some GoldRush endpoints return
      // a JSON body with `{ error_message, error_code }`.
      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch {
        /* ignore */
      }
      throw new Error(`Covalent HTTP ${res.status} ${res.statusText}: ${bodyText.slice(0, 240)}`);
    }
    const json = await res.json();
    const parsed = CovalentResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `Covalent response failed schema validation: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    return {
      items: parsed.data.data.items,
      hasMore: parsed.data.data.pagination.has_more,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch every swap record for a single V3 pool within an optional time
 * window. Throws if `COVALENT_API_KEY` is missing (use `isCovalentEnabled()`
 * first if you need a graceful fallback).
 */
export async function fetchCovalentSwaps(
  chainId: number,
  poolAddress: string,
  options: FetchCovalentSwapsOptions = {},
): Promise<CovalentSwap[]> {
  if (!poolAddress.startsWith('0x') || poolAddress.length !== 42) {
    throw new Error(`Invalid pool address: ${poolAddress}`);
  }
  const apiKey = options.apiKeyOverride ?? getCovalentApiKey();
  const chainName = covalentChainName(chainId);
  const startTime = options.startTime;
  const endTime = options.endTime;
  const key = cacheKey(chainId, poolAddress, startTime, endTime);
  const cached = cacheGet(key);
  if (cached) return cached;

  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  if (pageSize < 1 || pageSize > 1000) {
    throw new Error(`pageSize must be between 1 and 1000, got ${pageSize}`);
  }
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const fetchImpl = options.fetchImpl ?? fetch;

  const baseParams = new URLSearchParams({
    'quote-currency': 'USD',
    format: 'JSON',
    'page-size': String(pageSize),
    key: apiKey,
  });
  if (startTime) baseParams.set('start-timestamp', startTime.toISOString());
  if (endTime) baseParams.set('end-timestamp', endTime.toISOString());

  const url = `https://api.covalenthq.com/v1/${chainName}/uniswap_v3/pools/${poolAddress.toLowerCase()}/swaps/`;

  const collected: CovalentSwap[] = [];
  let pageNumber = 0;
  let hasMore = true;
  while (hasMore) {
    if (pageNumber >= maxPages) {
      throw new Error(
        `Covalent pagination exceeded maxPages=${maxPages} for ${chainName}:${poolAddress}. ` +
          `Narrow the time window or raise maxPages explicitly.`,
      );
    }
    const params = new URLSearchParams(baseParams);
    params.set('page-number', String(pageNumber));
    const page = await fetchPage(`${url}?${params.toString()}`, fetchImpl);
    for (const row of page.items) {
      collected.push({
        txHash: row.tx_hash,
        blockHeight: row.block_height,
        timestampISO: row.block_signed_at,
        timestampMs: Date.parse(row.block_signed_at),
        sender: row.sender_address,
        amount0: row.amount_0,
        amount1: row.amount_1,
        amountUSD: row.amount_usd,
        token0Address: row.token_0.contract_address,
        token1Address: row.token_1.contract_address,
        logOffset: row.log_offset,
      });
    }
    hasMore = page.hasMore;
    pageNumber += 1;
  }

  cachePut(key, collected);
  return collected;
}

// ----------------------------------------------------------------------------
// Helper — bucket per-swap records into per-day volume for the harness.
// Returns a Map keyed by unix-midnight-ms. Volume is the sum of `amount_usd`
// across swaps; dailyFeesUsd is the same volume times the fee rate.
// ----------------------------------------------------------------------------

/**
 * Aggregate a swap stream into per-day volume + fee data.
 * `feeRate` is the V3 fee as a decimal (e.g. 0.003 for the 0.3% tier).
 *
 * Swaps with `amountUSD === null` are skipped — they represent pools whose
 * router could not price one of the legs (typically brand-new illiquid
 * tokens). The caller can inspect the returned `nullCount` to surface this.
 */
export function aggregateCovalentSwapsByDay(
  swaps: CovalentSwap[],
  feeRate: number,
): {
  byDay: Map<number, { volumeUSD: number; dailyFeesUsd: number; swapCount: number }>;
  totalVolumeUSD: number;
  totalSwapCount: number;
  nullCount: number;
} {
  const byDay = new Map<number, { volumeUSD: number; dailyFeesUsd: number; swapCount: number }>();
  let totalVolumeUSD = 0;
  let totalSwapCount = 0;
  let nullCount = 0;
  for (const swap of swaps) {
    if (swap.amountUSD == null) {
      nullCount += 1;
      continue;
    }
    const day = Math.floor(swap.timestampMs / 86_400_000) * 86_400_000;
    let bucket = byDay.get(day);
    if (!bucket) {
      bucket = { volumeUSD: 0, dailyFeesUsd: 0, swapCount: 0 };
      byDay.set(day, bucket);
    }
    bucket.volumeUSD += swap.amountUSD;
    bucket.swapCount += 1;
    totalVolumeUSD += swap.amountUSD;
    totalSwapCount += 1;
  }
  for (const bucket of byDay.values()) {
    bucket.dailyFeesUsd = bucket.volumeUSD * feeRate;
  }
  return { byDay, totalVolumeUSD, totalSwapCount, nullCount };
}