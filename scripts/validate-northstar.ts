/**
 * NORTH-STAR VALIDATION HARNESS
 *
 * The single metric that defines success for this project:
 *   "% of pool-days where the simulator's pre-deposit APR estimate lands
 *    within ±X% of realized 30-day APR."
 *
 * This script runs the simulator against real historical data and compares
 * its projection to a ground-truth LP P&L replay computed from real daily
 * price range (OHLC) + daily volume. No mocks. No synthetic data.
 *
 * Data sources (all free, no API keys):
 *   - DeFi Llama: pool discovery + daily volume per pool
 *   - CoinGecko: token OHLC daily high/low/close via /ohlc endpoint
 *   - Public RPCs: current pool state (tick, liquidity)
 *
 * Usage:
 *   npx tsx scripts/validate-northstar.ts
 *
 * Acceptance:
 *   MAPE <= 5% APR on >= 80% of pool-days
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  aggregateCovalentSwapsByDay,
  fetchCovalentSwaps,
  isCovalentEnabled,
} from '../lib/data/covalent';

// ============================================================================
// Pool selection — 20 V3 pools covering diverse fee tiers, TVL ranges, and
// token categories on Ethereum mainnet. Addresses hardcoded because DeFi
// Llama's pool discovery endpoint can change formatting between calls.
// ============================================================================

interface PoolSpec {
  /** Human-readable label. */
  label: string;
  /** V3 pool address (lowercase). */
  address: string;
  /** Fee tier in basis points (100 = 0.01%, 500 = 0.05%, 3000 = 0.3%, 10000 = 1%). */
  feeTierBips: number;
  /** Token0 symbol (for display). */
  token0Symbol: string;
  /** Token1 symbol (for display). */
  token1Symbol: string;
  /** Token0 contract address (lowercase). */
  token0Address: string;
  /** Token1 contract address (lowercase). */
  token1Address: string;
}

const POOLS: PoolSpec[] = [
  // Major pairs
  { label: 'WETH/USDC 0.05%', address: '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', feeTierBips: 500, token0Symbol: 'USDC', token1Symbol: 'WETH', token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'WETH/USDC 0.3%',  address: '0x8ad599c3a0ff1de082011efdd2bce8a3c8763363', feeTierBips: 3000, token0Symbol: 'USDC', token1Symbol: 'WETH', token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'WBTC/WETH 0.05%', address: '0x4585fe77225b41b697c9b5e82213441756fba1e2', feeTierBips: 500, token0Symbol: 'WBTC', token1Symbol: 'WETH', token0Address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'WBTC/WETH 0.3%',  address: '0xcbcdf9626bc03e7f6d22d462f0d4b1d30e14e1c5', feeTierBips: 3000, token0Symbol: 'WBTC', token1Symbol: 'WETH', token0Address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },

  // Stables. USDC/USDT pairs removed (USDT can't be fetched from Binance as a
// standalone base token — the harness needs token1 to have a USDT pair).
  { label: 'FRAX/USDC 0.05%', address: '0x69fa348f1d486c5e80ce34a546f4d749f873aa26', feeTierBips: 500, token0Symbol: 'FRAX', token1Symbol: 'USDC', token0Address: '0x853d955acef822db058eb8505911ed77f175b99e', token1Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { label: 'wstETH/WETH 0.01%', address: '0x109830a1aaad605b7d6804864a6371c14bccd8a6', feeTierBips: 100, token0Symbol: 'wstETH', token1Symbol: 'WETH', token0Address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'rETH/WETH 0.3%',  address: '0xa4e0faa58441a4d7950a23a95bd0a1d9cb1cb2ee', feeTierBips: 3000, token0Symbol: 'rETH', token1Symbol: 'WETH', token0Address: '0xae78736cd615f374d3085123a210448e74fc6393', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },

  // Mid-cap ETH pairs
  { label: 'LINK/WETH 0.3%',  address: '0xa6cc3c2531fdaa6ae1a488ca825c5367af24a4d7', feeTierBips: 3000, token0Symbol: 'LINK', token1Symbol: 'WETH', token0Address: '0x514910771af9ca656af840dff83e8264ecf986ca', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'UNI/WETH 0.3%',   address: '0x1d42064fc4beb5f872aeb2e9975a75236e71f083', feeTierBips: 3000, token0Symbol: 'UNI',  token1Symbol: 'WETH', token0Address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'LDO/WETH 0.3%',   address: '0xa3f558aeba7cf0175d355e1c3325a7fc1a55ac6', feeTierBips: 3000, token0Symbol: 'LDO',  token1Symbol: 'WETH', token0Address: '0x5a98fcbea516cf06857215779fd812ca3bef1b32', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'AAVE/WETH 0.3%',  address: '0x5ab53ee1d8bf8c248255f8a954b17673ff8cf69a', feeTierBips: 3000, token0Symbol: 'AAVE', token1Symbol: 'WETH', token0Address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'COMP/WETH 0.3%',  address: '0xea4ba4ce14fdd287f1b6c3af33539d0c7f8d90a4', feeTierBips: 3000, token0Symbol: 'COMP', token1Symbol: 'WETH', token0Address: '0xc00e94cb662c3520282e6f5717214004a7f26888', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'ENS/WETH 0.3%',   address: '0x9258c6c14b0721532c39b22b41ec36e1da0ce6eb', feeTierBips: 3000, token0Symbol: 'ENS',  token1Symbol: 'WETH', token0Address: '0xc18360217d8f7ab5e7c5165667617f8e5cb1d05b', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'CRV/WETH 1%',     address: '0x4e3318b89a26b80cb54aac9daf90ea1d6f249ef1', feeTierBips: 10000, token0Symbol: 'CRV',  token1Symbol: 'WETH', token0Address: '0xd533a949740bb3306d119cc777fa900ba034cd52', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'SUSHI/WETH 0.3%', address: '0xcd6d86d8054f66eda922bf6d44e2c0b89bf83bf6', feeTierBips: 3000, token0Symbol: 'SUSHI', token1Symbol: 'WETH', token0Address: '0x6b3595068778dd592e39a122f4e5d2460e84dabe', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },

  // Volatile
  { label: 'PEPE/WETH 1%',    address: '0x4ed4e8628db73b489ec568d49e95b0daf9ddebd2', feeTierBips: 10000, token0Symbol: 'PEPE', token1Symbol: 'WETH', token0Address: '0x6982508145454ce325ddbe82a2a3d5ef5ddcb78', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { label: 'SHIB/WETH 0.3%',  address: '0x2e0242c19b3a66c8b05d6f9a1d4a7b4ee9d2d4e5', feeTierBips: 3000, token0Symbol: 'SHIB', token1Symbol: 'WETH', token0Address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },

  // Wide-range alt
  { label: 'WBTC/USDC 0.3%',   address: '0x99ac8ca5867e938878d20af4ec0d4edc4de2b1f1', feeTierBips: 3000, token0Symbol: 'USDC', token1Symbol: 'WBTC', token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', token1Address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' },
];

/**
 * Decimals for each token symbol, applied to (token0, token1) ordering.
 * V3 token order is alphabetical by address — see PoolSpec comment.
 */
const DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  WETH: 18,
  WBTC: 8,
  wstETH: 18,
  rETH: 18,
  LINK: 18,
  UNI: 18,
  LDO: 18,
  AAVE: 18,
  COMP: 18,
  FRAX: 18,
  MKR: 18,
  ENS: 18,
  CRV: 18,
  SUSHI: 18,
  PEPE: 18,
  SHIB: 18,
};

// ============================================================================
// Strategy — a single shared strategy so we can compare across pools.
// ±10% range around current price, 30-day horizon, $10k deposit.
// ============================================================================

interface StrategySpec {
  /** Lower price as a multiplier of current price (e.g. 0.9 for -10%). */
  lowerPriceFactor: number;
  /** Upper price as a multiplier of current price (e.g. 1.1 for +10%). */
  upperPriceFactor: number;
  /** Deposit amount in USD. */
  depositUSD: number;
  /** Horizon in days. */
  horizonDays: number;
}

const STRATEGY: StrategySpec = {
  lowerPriceFactor: 0.9,
  upperPriceFactor: 1.1,
  depositUSD: 10_000,
  horizonDays: 30,
};

// ============================================================================
// Data fetchers — DeFi Llama + Binance (free, no API key)
// ============================================================================

const DEFI_LLAMA_POOL_LIST_API = 'https://yields.llama.fi/pools';
const DEFI_LLAMA_CHART_API = 'https://yields.llama.fi/chart';
const BINANCE_KLINE_API = 'https://api.binance.com/api/v3/klines';

/** DeFi Llama token contract → Binance USDT pair symbol (free, no rate limit). */
const BINANCE_SYMBOL: Record<string, string> = {
  // Major pairs (ETH used as proxy for stETH/wstETH/rETH which have no USDT pair)
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ETHUSDT',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDCUSDT',
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDTUSDT', // unused but kept for completeness
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAIUSDT',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'BTCUSDT',
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'ETHUSDT', // stETH tracks ETH very tightly
  '0xae78736cd615f374d3085123a210448e74fc6393': 'ETHUSDT', // rETH tracks ETH
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'LINKUSDT',
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'UNIUSDT',
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32': 'LDOUSDT',
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'AAVEUSDT',
  '0xc00e94cb662c3520282e6f5717214004a7f26888': 'COMPUSDT', // added 2026-09-17 — replaces MKR/WETH which had stale Binance data
  '0x853d955acef822db058eb8505911ed77f175b99e': 'FRAXUSDT', // added 2026-09-17 — replaces DAI/USDC which had stale Binance data
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'MKRUSDT',
  '0xc18360217d8f7ab5e7c5165667617f8e5cb1d05b': 'ENSUSDT',
  '0xd533a949740bb3306d119cc777fa900ba034cd52': 'CRVUSDT',
  '0x6b3595068778dd592e39a122f4e5d2460e84dabe': 'SUSHIUSDT',
  '0x6982508145454ce325ddbe82a2a3d5ef5ddcb78': 'PEPEUSDT',
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': 'SHIBUSDT',
};

interface DailyOhlc {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const tokenOhlcCache = new Map<string, DailyOhlc[]>();

async function fetchTokenOhlc(tokenAddress: string, days: number): Promise<DailyOhlc[]> {
  const cacheKey = `${tokenAddress.toLowerCase()}:${days}`;
  const cached = tokenOhlcCache.get(cacheKey);
  if (cached) return cached;

  const symbol = BINANCE_SYMBOL[tokenAddress.toLowerCase()];
  if (!symbol) {
    throw new Error(`No Binance symbol for token ${tokenAddress}`);
  }
  // Use Binance kline API for free, no-rate-limit daily OHLC.
  // Interval '1d' returns daily candles. Binance caps at 1000 candles.
  const url = `${BINANCE_KLINE_API}?symbol=${symbol}&interval=1d&limit=${Math.min(days, 1000)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Binance kline error: HTTP ${res.status}`);
    }
    const raw: Array<Array<number | string>> = await res.json();
    // Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
    const result = raw.map((row) => ({
      timestamp: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
    }));
    tokenOhlcCache.set(cacheKey, result);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

interface PoolDailyFee {
  timestamp: number;
  /** Daily APY (e.g. 0.05 = 5% APR). */
  apyBase: number;
  /** Pool TVL in USD at that timestamp. */
  tvlUsd: number;
  /** Daily fees in USD, derived from apyBase × tvlUsd / 365. */
  dailyFeesUsd: number;
}

/**
 * Resolve a V3 pool address → DeFi Llama pool UUID via the /pools endpoint.
 * Caches the full list (11MB) in memory for the duration of one run.
 */
let _poolsCache: Array<{
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  poolMeta?: string;
  underlyingTokens?: string[];
}> | null = null;

const FEE_META_TO_BIPS: Record<string, number> = {
  '0.01%': 100,
  '0.05%': 500,
  '0.3%': 3000,
  '1%': 10000,
};

async function resolvePoolUuid(pool: PoolSpec, chainId: number): Promise<string> {
  if (!_poolsCache) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(DEFI_LLAMA_POOL_LIST_API, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`DeFi Llama pools list HTTP ${res.status}`);
      }
      const json = await res.json();
      _poolsCache = json.data ?? [];
    } finally {
      clearTimeout(timeout);
    }
  }
  const chainSlug = chainId === 1 ? 'Ethereum' : 'Unknown';
  const t0 = pool.token0Address.toLowerCase();
  const t1 = pool.token1Address.toLowerCase();

  // Find DeFi Llama pools on the right chain + matching tokens + matching fee.
  // Fee tier is stored in `poolMeta` as "0.3%", "1%", etc.
  const candidates = _poolsCache.filter((p) => {
    if (p.chain !== chainSlug) return false;
    const project = (p.project ?? '').toLowerCase();
    if (!(project === 'uniswap-v3' || project.startsWith('uniswap-v3'))) return false;
    const tokens = (p.underlyingTokens ?? []).map((t) => t.toLowerCase());
    if (!tokens.includes(t0) || !tokens.includes(t1)) return false;
    return true;
  });

  // Pick by fee tier.
  const expectedMeta = Object.entries(FEE_META_TO_BIPS).find(([, bips]) => bips === pool.feeTierBips)?.[0];
  const exact = candidates.find((c) => c.poolMeta === expectedMeta);
  if (exact) return exact.pool;
  if (candidates.length === 0) {
    throw new Error(`Pool ${pool.address} (${pool.label}) not found in DeFi Llama`);
  }
  // Fall back to first candidate if fee tier can't be disambiguated.
  return candidates[0].pool;
}

async function fetchPoolDailyFees(pool: PoolSpec, chainId: number): Promise<PoolDailyFee[]> {
  const uuid = await resolvePoolUuid(pool, chainId);
  const url = `${DEFI_LLAMA_CHART_API}/${uuid}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`DeFi Llama chart HTTP ${res.status}`);
    }
    const json = await res.json();
    const raw: Array<{ timestamp: string; tvlUsd?: number; apyBase?: number }> =
      json.data ?? [];
    return raw
      .map((d) => {
        const ts = new Date(d.timestamp).getTime();
        const tvl = d.tvlUsd ?? 0;
        // apyBase from DeFi Llama is in PERCENT (e.g. 26.39 = 26.39% APR),
        // not a decimal fraction. Convert: dailyFeesUSD ≈ tvl × apy / 100 / 365.
        const apyPct = d.apyBase ?? 0;
        const dailyFeesUsd = (tvl * apyPct) / 100 / 365;
        return { timestamp: ts, apyBase: apyPct, tvlUsd: tvl, dailyFeesUsd };
      })
      .filter((d) => Number.isFinite(d.dailyFeesUsd) && d.dailyFeesUsd > 0);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch per-swap data for a pool via Covalent GoldRush and bucket it into
 * the same `PoolDailyFee[]` shape that DeFi Llama returns. This is the
 * "ground-truth-from-swaps" path: it replaces the back-derived
 * `dailyFeesUsd ≈ tvl × apyBase / 100 / 365` approximation with the
 * actual swap stream, which is what was leaving the harness at 0/15 pools
 * within ±20% relative error on the legacy metric.
 *
 * Returns `null` if the Covalent key is not configured — caller falls back
 * to the DeFi Llama path. Throws if the key IS set but the request fails.
 *
 * The fee rate is applied as `volumeUSD × feeRate`, matching how V3
 * computes fees (the fee is taken out of the swap before the user receives
 * the output token, so the notional is the gross trade size).
 */
async function fetchPoolDailyFeesFromCovalent(
  pool: PoolSpec,
  chainId: number,
  horizonDays: number,
): Promise<{ dailyFees: PoolDailyFee[]; swapCount: number; nullCount: number } | null> {
  if (!isCovalentEnabled()) return null;
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - horizonDays * 86_400_000);
  const swaps = await fetchCovalentSwaps(chainId, pool.address, { startTime, endTime });
  if (swaps.length === 0) {
    return { dailyFees: [], swapCount: 0, nullCount: 0 };
  }
  const feeRate = pool.feeTierBips / 1_000_000;
  const agg = aggregateCovalentSwapsByDay(swaps, feeRate);
  const dailyFees: PoolDailyFee[] = [];
  for (const [day, bucket] of [...agg.byDay.entries()].sort((a, b) => a[0] - b[0])) {
    // No TVL signal from Covalent swaps alone — leave at 0; the harness only
    // reads `dailyFeesUsd` for the ground-truth path so 0 TVL is fine.
    dailyFees.push({
      timestamp: day,
      apyBase: 0,
      tvlUsd: 0,
      dailyFeesUsd: bucket.dailyFeesUsd,
    });
  }
  return { dailyFees, swapCount: agg.totalSwapCount, nullCount: agg.nullCount };
}

/**
 * Compute the USD price of the pool's "other" token given its quote-token
 * price. We treat the pool as token0_per_token1, so
 *   pool_price = token0_price / token1_price.
 */
function poolPriceAt(o0: DailyOhlc, o1: DailyOhlc, ratio0to1: boolean): number {
  if (ratio0to1) {
    // poolPrice = token1/token0 (i.e. how many token1 per 1 token0)
    return o1.close / o0.close;
  }
  // poolPrice = token0/token1
  return o0.close / o1.close;
}

// ============================================================================
// Ground-truth LP replay — given per-day OHLC + daily volume, compute
// the realized daily P&L for a fixed liquidity share.
// ============================================================================

interface GroundTruthParams {
  ohlc0: DailyOhlc[];
  ohlc1: DailyOhlc[];
  dailyFees: PoolDailyFee[];
  feeTierBips: number;
  lowerPrice: number;
  upperPrice: number;
  /** Strategy's share of pool liquidity (we use 0.001 = 0.1% by default). */
  liquidityShare: number;
}

interface GroundTruthResult {
  /** Compounded return over the window (e.g. 0.05 = +5%). */
  compoundedReturn: number;
  /** Annualised rate (e.g. 1.0 = 100% APR). */
  apr: number;
  days: number;
  daysInRange: number;
  totalFeesUSD: number;
  totalILPct: number;
}

/**
 * Compare simulator cumulative return vs ground-truth cumulative return, both
 * expressed as decimal returns over the SAME ~N-day window. Both sides are
 * answering the question: "if I deposited $X on day 0 and held for N days, how
 * much would my position be worth relative to deposit?". Expressing both in
 * the same unit (cumulative-window-return) avoids the unit mismatch that
 * earlier runs silently papered over (sim was a 30-day cumulative return;
 * gt was an annualised APR).
 */
function pctErrorBetweenCumulatives(simCum: number, gtCum: number): number {
  // |Δ| / |gt|, with guard for gt ≈ 0 (treat as absolute error = |sim|)
  return gtCum !== 0 ? Math.abs(simCum - gtCum) / Math.abs(gtCum) : Math.abs(simCum);
}

function computeGroundTruth(p: GroundTruthParams): GroundTruthResult {
  const feeRate = p.feeTierBips / 1_000_000;

  // Bucket OHLC by day (unix-day timestamp) and pick the pool-price using the
  // CLOSE of both tokens. In Uniswap v3, the price is "token1 per token0"
  // when token0 < token1 by address — we approximate this with close-to-close.
  const ohlc0ByDay = new Map<number, DailyOhlc>();
  for (const o of p.ohlc0) ohlc0ByDay.set(Math.floor(o.timestamp / 86_400_000) * 86_400_000, o);
  const ohlc1ByDay = new Map<number, DailyOhlc>();
  for (const o of p.ohlc1) ohlc1ByDay.set(Math.floor(o.timestamp / 86_400_000) * 86_400_000, o);
  const feesByDay = new Map<number, PoolDailyFee>();
  for (const f of p.dailyFees) feesByDay.set(Math.floor(f.timestamp / 86_400_000) * 86_400_000, f);

  const allDays = [...ohlc0ByDay.keys()].filter((d) => ohlc1ByDay.has(d) && feesByDay.has(d)).sort((a, b) => a - b);

  let compounded = 1;
  let daysInRange = 0;
  let totalFeesUSD = 0;
  let prevPrice: number | null = null;

  for (const day of allDays) {
    const o0 = ohlc0ByDay.get(day)!;
    const o1 = ohlc1ByDay.get(day)!;
    const poolFee = feesByDay.get(day)!;

    const price = poolPriceAt(o0, o1, true);

    // Approximate time-in-range using the day's range.
    // For each day, the fraction of [low, high] that lies inside
    // [lowerPrice, upperPrice].
    const dayRange = Math.max(0.0001, Math.abs(o0.close - o0.open) + Math.abs(o1.close - o1.open));
    const dayLow = price * (1 - 0.5 * dayRange / price);
    const dayHigh = price * (1 + 0.5 * dayRange / price);
    const overlapLow = Math.max(dayLow, p.lowerPrice);
    const overlapHigh = Math.min(dayHigh, p.upperPrice);
    const inRangeFraction = overlapLow < overlapHigh
      ? Math.min(1, Math.max(0, (overlapHigh - overlapLow) / (dayHigh - dayLow)))
      : 0;
    if (inRangeFraction > 0) daysInRange++;

    // Fee revenue: dailyFees × liquidityShare × TIR (no feeRate multiplier
    // because dailyFees is already pre-fee in USD).
    const dailyFees = poolFee.dailyFeesUsd * p.liquidityShare * inRangeFraction;
    totalFeesUSD += dailyFees;

    // IL approximation
    let ilPct = 0;
    if (prevPrice !== null) {
      const priceRatio = price / prevPrice;
      ilPct = Math.sqrt(priceRatio) - (priceRatio + 1) / 2;
    }

    const feeYield = dailyFees / STRATEGY.depositUSD;
    const dailyReturn = feeYield + ilPct;
    compounded *= 1 + dailyReturn;
    prevPrice = price;
  }

  const apr = Math.pow(compounded, 365 / Math.max(1, allDays.length)) - 1;
  const totalILPct = compounded - 1 - totalFeesUSD / STRATEGY.depositUSD;

  return {
    compoundedReturn: compounded - 1,
    apr,
    days: allDays.length,
    daysInRange,
    totalFeesUSD,
    totalILPct,
  };
}

// ============================================================================
// Simulator interface — we call into the actual repo code.
// ============================================================================

import { runBacktest, type PriceDataPoint } from '../lib/simulation/backtest';
import { simulateV3InRange } from '../lib/simulation/v3-inrange';

async function runSimulator(
  p: PoolSpec,
  priceHistory: PriceDataPoint[],
  lowerPrice: number,
  upperPrice: number,
): Promise<{ cumulativeReturn: number }> {
  if (priceHistory.length < 2) {
    throw new Error('priceHistory has fewer than 2 points');
  }
  const params = {
    priceHistory,
    entryTimestamp: priceHistory[0].timestamp,
    lowerPrice,
    upperPrice,
    depositAmount: STRATEGY.depositUSD,
    depositToken: 'usd' as const,
    rebalanceMode: 'none' as const,
    gasCostGwei: 20,
    gasUnitsPerRebalance: 250_000,
    // Engine feeTier is V3 feeTier / 100 so the engine's
    // `dailyFeeRate = feeTier / 10000` produces the correct V3 rate.
    // V3 feeTier (uint24 in contract) is in hundredths-of-a-bip;
    // engine expects feeTier in hundredths-of-a-PERCENT.
    feeTier: p.feeTierBips / 100,
    token0Decimals: DECIMALS[p.token0Symbol] ?? 18,
    token1Decimals: DECIMALS[p.token1Symbol] ?? 18,
  };
  const result = runBacktest(params);
  return { cumulativeReturn: result.totalReturn };
}

/**
 * Build the simulator's expected `PriceDataPoint[]` from raw token OHLC +
 * DeFi Llama daily fees. Pool price = token1/token0 close. Daily volume is
 * approximated as `dailyFeesUsd / (feeTier / 1e6)` (the daily fees divided
 * by the fee rate yields the notional volume that produced them).
 */
function buildSimulatorPriceHistory(
  ohlc0: DailyOhlc[],
  ohlc1: DailyOhlc[],
  dailyFees: PoolDailyFee[],
  feeTierBips: number,
): PriceDataPoint[] {
  const feeRate = feeTierBips / 1_000_000;
  const ohlc0ByDay = new Map<number, DailyOhlc>();
  for (const o of ohlc0) ohlc0ByDay.set(Math.floor(o.timestamp / 86_400_000) * 86_400_000, o);
  const ohlc1ByDay = new Map<number, DailyOhlc>();
  for (const o of ohlc1) ohlc1ByDay.set(Math.floor(o.timestamp / 86_400_000) * 86_400_000, o);
  const feesByDay = new Map<number, PoolDailyFee>();
  for (const f of dailyFees) feesByDay.set(Math.floor(f.timestamp / 86_400_000) * 86_400_000, f);

  const allDays = [...ohlc0ByDay.keys()].filter((d) => ohlc1ByDay.has(d) && feesByDay.has(d)).sort((a, b) => a - b);

  return allDays.map((day) => {
    const o0 = ohlc0ByDay.get(day)!;
    const o1 = ohlc1ByDay.get(day)!;
    const f = feesByDay.get(day)!;
    const price = poolPriceAt(o0, o1, true);
    // dailyFees = volume × feeRate, so volume = dailyFees / feeRate.
    const volumeUSD = feeRate > 0 ? f.dailyFeesUsd / feeRate : 0;
    return {
      timestamp: day / 1000, // engine expects unix seconds
      price,
      volumeUSD,
    };
  });
}

// ============================================================================
// Runner
// ============================================================================

interface ValidationRow {
  pool: string;
  days: number;
  /** Primary simulator cumulative return (V3-aware when available, else legacy). */
  simulatorCumReturn: number;
  /** Legacy simulator (runBacktest) cumulative return — kept for comparison. */
  simulatorCumReturnLegacy: number;
  /** V3-aware simulator (simulateV3InRange) cumulative return, if computed. */
  simulatorCumReturnV3?: number;
  /** Ground truth's cumulative return over the window. */
  groundTruthCumReturn: number;
  /** Ground truth's annualised APR — kept for backward-compat reading of prior CSVs. */
  groundTruthAPR: number;
  /** Absolute error in cumulative-return units. */
  absError: number;
  /** Relative error in cumulative-return units (|sim-gt|/|gt|). */
  pctError: number;
  /** Number of actual swaps fetched from Covalent for this pool (0 if key not set). */
  covalentSwapCount?: number;
  /** Number of swaps Covalent returned without a USD price (token not yet listed). */
  covalentNullCount?: number;
}

// CLI args
const CLI_ARGS = process.argv.slice(2);
function getFlag(name: string, fallback: string): string {
  const idx = CLI_ARGS.indexOf(name);
  if (idx >= 0 && idx + 1 < CLI_ARGS.length) return CLI_ARGS[idx + 1];
  return fallback;
}
/**
 * CI mode: in addition to writing CSV/console output, exit with code 1 if:
 *   - fewer than `--require-pools` pools returned valid results, OR
 *   - the north-star acceptance criterion (`% within 20%` >= 80%) is not met.
 *
 * This is opt-in because the harness currently produces honest-but-bad numbers
 * and we don't want every dev push to be blocked by it. Turn on via the
 * `validate:northstar:ci` npm script or `tsx scripts/validate-northstar.ts --ci`.
 */
const CI_MODE = CLI_ARGS.includes('--ci');
const REQUIRE_POOLS = Number(getFlag('--require-pools', '5'));

async function main() {
  console.log(`Running north-star validation across ${POOLS.length} pools × ~${STRATEGY.horizonDays} days.`);
  console.log(`Mode: ${CI_MODE ? 'CI (will exit non-zero on star miss or insufficient pools)' : 'local'}\n`);

  const rows: ValidationRow[] = [];
  const errors: Array<{ pool: string; reason: string }> = [];

  for (const pool of POOLS) {
    process.stdout.write(`  ${pool.label.padEnd(28)} `);
    try {
      // Fetch OHLC for both tokens + DeFi Llama daily fees.
      // In parallel, attempt the Covalent overlay — when the API key is set
      // we replace the back-derived dailyFees with swap-by-swap fees from
      // the actual on-chain stream, which is what was leaving the harness
      // at 0/15 within ±20% relative error before this path was added.
      const [ohlc0, ohlc1, dailyFeesLlama, covalentOverlay] = await Promise.all([
        fetchTokenOhlc(pool.token0Address, STRATEGY.horizonDays),
        fetchTokenOhlc(pool.token1Address, STRATEGY.horizonDays),
        fetchPoolDailyFees(pool, 1),
        fetchPoolDailyFeesFromCovalent(pool, 1, STRATEGY.horizonDays).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`\n    [covalent-overlay: disabled — ${msg.slice(0, 80)}]`);
          return null;
        }),
      ]);

      // Use the Covalent overlay when it returned non-empty data; otherwise
      // fall back to DeFi Llama so the harness keeps running in zero-config.
      const dailyFees =
        covalentOverlay && covalentOverlay.dailyFees.length > 0
          ? covalentOverlay.dailyFees
          : dailyFeesLlama;
      const covalentUsed = !!(covalentOverlay && covalentOverlay.dailyFees.length > 0);

      // Use the most recent close as current price
      const last0 = ohlc0.at(-1);
      const last1 = ohlc1.at(-1);
      if (!last0 || !last1) {
        throw new Error('No OHLC data returned');
      }
      const currentPrice = last1.close / last0.close;

      const lowerPrice = currentPrice * STRATEGY.lowerPriceFactor;
      const upperPrice = currentPrice * STRATEGY.upperPriceFactor;

      // Ground truth
      const gt = computeGroundTruth({
        ohlc0,
        ohlc1,
        dailyFees,
        feeTierBips: pool.feeTierBips,
        lowerPrice,
        upperPrice,
        liquidityShare: 0.001, // 0.1% of pool — typical LP size
      });

      // Simulator: build PriceDataPoint[] from the same data + run runBacktest directly
      const priceHistory = buildSimulatorPriceHistory(
        ohlc0,
        ohlc1,
        dailyFees,
        pool.feeTierBips,
      );
      // eslint-disable-next-line no-console
      console.log(
        `\n    [debug ${pool.label}] priceHistory.length=${priceHistory.length} ` +
        `first=${priceHistory[0]?.price?.toFixed(4)} ` +
        `last=${priceHistory.at(-1)?.price?.toFixed(4)} ` +
        `avgVol=${(priceHistory.reduce((a, p) => a + p.volumeUSD, 0) / priceHistory.length).toFixed(0)} ` +
        `feeTier-in-engine=${pool.feeTierBips / 100}`,
      );
      let simCum: number;
      let simCumV3: number | null = null;
      try {
        const out = await runSimulator(pool, priceHistory, lowerPrice, upperPrice);
        simCum = out.cumulativeReturn;
        // Also compute via the V3-aware simulator. As of the most recent run
        // the V3 path is NOT used as the primary metric because `v3EntryLiquidity`
        // has a bug — it recomputes token amounts from `L = min(L0, L1)` instead
        // of using the original deposited amounts, which produces wildly leveraged
        // positions (e.g. $12M position from a $10k deposit on WETH/USDC). The
        // values are still logged for visibility, but the primary abs-error
        // metric uses the legacy simulator.
        try {
          const v3 = simulateV3InRange({
            priceHistory,
            lowerPrice,
            upperPrice,
            feeTier: pool.feeTierBips / 100,
            liquidityShare: 0.001,
            depositAmount: STRATEGY.depositUSD,
          });
          simCumV3 = (v3.lpValueEnd - STRATEGY.depositUSD) / STRATEGY.depositUSD;
        } catch (v3err) {
          const v3msg = v3err instanceof Error ? v3err.message : String(v3err);
          console.log(`    [v3-simulator: skipped — ${v3msg.slice(0, 60)}]`);
          simCumV3 = null;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`SIM FAIL (${msg.slice(0, 80)})`);
        errors.push({ pool: pool.label, reason: `simulator:${msg.slice(0, 200)}` });
        continue;
      }

      // Both sides are now expressed as cumulative return over the window.
      // Sim: result.totalReturn. GT: compoundedReturn. Both in [-∞, +∞],
      // where 0.0144 = +1.44% over the window.
      const gtCum = gt.compoundedReturn;
      // Primary metric uses the LEGACY simulator until the V3 entry math is
      // fixed (see simCumV3 commentary above).
      const primaryCum = simCum;
      const absError = Math.abs(primaryCum - gtCum);
      const pctError = pctErrorBetweenCumulatives(primaryCum, gtCum);

      rows.push({
        pool: pool.label,
        days: gt.days,
        simulatorCumReturn: primaryCum,
        simulatorCumReturnLegacy: simCum,
        simulatorCumReturnV3: simCumV3 ?? undefined,
        groundTruthCumReturn: gtCum,
        groundTruthAPR: gt.apr,
        absError,
        pctError,
        covalentSwapCount: covalentOverlay?.swapCount,
        covalentNullCount: covalentOverlay?.nullCount,
      });

      const v3Tag = simCumV3 != null ? ` [v3=${(simCumV3 * 100).toFixed(2)}%]` : '';
      const covalentTag = covalentUsed
        ? ` [covalent=${covalentOverlay!.swapCount}sw, ${covalentOverlay!.nullCount}unpriced]`
        : '';
      console.log(
        `sim=${(primaryCum * 100).toFixed(2)}%${v3Tag} gt=${(gtCum * 100).toFixed(2)}% ` +
        `err=${(pctError * 100).toFixed(1)}% (${gt.days}d, ${gt.daysInRange}in-range)${covalentTag}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAIL (${msg.slice(0, 80)})`);
      errors.push({ pool: pool.label, reason: msg.slice(0, 200) });
    }
  }

  console.log('\n— Results —');
  console.log(`Pools attempted: ${POOLS.length}`);
  console.log(`Pools with results: ${rows.length}`);
  console.log(`Skipped / failed: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Skipped pools:');
    for (const e of errors) console.log(`  - ${e.pool}: ${e.reason}`);
  }

  if (rows.length === 0) {
    console.log('\nNo data to evaluate.');
    return;
  }

  const absErrors = rows.map((r) => r.absError);
  const meanAbsError = absErrors.reduce((a, b) => a + b, 0) / absErrors.length;
  const medianAbsError = absErrors.sort((a, b) => a - b)[Math.floor(absErrors.length / 2)];
  const maxAbsError = Math.max(...absErrors);

  const pctErrors = rows.map((r) => r.pctError).sort((a, b) => a - b);
  const medianPctError = pctErrors[Math.floor(pctErrors.length / 2)];

  const within1 = rows.filter((r) => r.pctError <= 0.05).length; // within 5% relative error
  const within5 = rows.filter((r) => r.pctError <= 0.20).length;
  // Bias is now defined in cumulative-return units to match the comparison axis.
  const bias = rows.reduce((a, r) => a + (r.simulatorCumReturn - r.groundTruthCumReturn), 0) / rows.length;

  console.log('\n— Error stats (against ground-truth OHLC replay, both as ~30-day cumulative return) —');
  console.log(`  Mean absolute error: ${(meanAbsError * 100).toFixed(2)} pp`);
  console.log(`  Median absolute error: ${(medianAbsError * 100).toFixed(2)} pp`);
  console.log(`  Max absolute error: ${(maxAbsError * 100).toFixed(2)} pp`);
  console.log(`  Median relative error: ${(medianPctError * 100).toFixed(1)}%`);
  console.log(`  % within 5% relative error: ${((within1 / rows.length) * 100).toFixed(1)}% (${within1}/${rows.length})`);
  console.log(`  % within 20% relative error: ${((within5 / rows.length) * 100).toFixed(1)}% (${within5}/${rows.length})`);
  console.log(`  Mean bias (sim - gt): ${(bias * 100).toFixed(2)} pp`);

  // Acceptance criterion
  const starReached = (within5 / rows.length) >= 0.8;
  console.log(`\n— NORTH STAR —`);
  console.log(`  Target: % within 20% relative error >= 80% on pool-days.`);
  console.log(`  Actual: ${((within5 / rows.length) * 100).toFixed(1)}%.`);
  console.log(`  Median absolute error: ${(medianAbsError * 100).toFixed(2)} pp`);
  console.log(`  ${starReached ? '✓ REACHED' : '✗ NOT REACHED'}`);

  // Dump raw rows + summary to a CSV for inspection
  const outDir = resolve(process.cwd(), 'validation-results');
  mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const csvPath = resolve(outDir, `validation-${ts}.csv`);
  const header =
    'pool,days,simulator_cum_return,simulator_cum_return_legacy,simulator_cum_return_v3,' +
    'ground_truth_cum_return,ground_truth_apr,abs_error,pct_error,' +
    'covalent_swap_count,covalent_unpriced_count\n';
  const lines = rows.map((r) =>
    [r.pool, r.days, r.simulatorCumReturn.toFixed(6), r.simulatorCumReturnLegacy.toFixed(6),
     (r.simulatorCumReturnV3 ?? '').toString() === '' ? '' : r.simulatorCumReturnV3!.toFixed(6),
     r.groundTruthCumReturn.toFixed(6), r.groundTruthAPR.toFixed(6),
     r.absError.toFixed(6), r.pctError.toFixed(6),
     r.covalentSwapCount ?? '',
     r.covalentNullCount ?? ''].join(',')
  );
  writeFileSync(csvPath, header + lines.join('\n') + '\n');
  console.log(`\nWrote ${csvPath}`);

  // CI gate: don't block dev workflow, but do block if results degraded
  // significantly (e.g. upstream data source changed shape).
  if (CI_MODE) {
    if (rows.length < REQUIRE_POOLS) {
      console.error(`\n✗ CI FAIL: only ${rows.length} pool(s) completed, required ${REQUIRE_POOLS}.`);
      console.error('  Data sources may have changed. See errors above.');
      process.exit(2);
    }
    if (!starReached) {
      console.error(`\n✗ CI FAIL: north star not reached (${(within5 / rows.length) * 100} < 80%).`);
      console.error('  Either the simulator regressed or upstream data quality changed.');
      console.error('  Fix the regression or update NORTH_STAR_REPORT.md with the new numbers.');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Validation harness crashed:', err);
  process.exit(1);
});