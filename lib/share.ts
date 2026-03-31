/**
 * Share Module
 * 
 * Handles encoding/decoding strategy parameters to/from shareable URLs.
 * Enables users to share their LP strategies with others.
 */

import { SavedStrategy, Pool } from '@/types';

interface StrategyParams {
  depositAmount: string;
  depositToken: 'token0' | 'token1' | 'usd';
  lowerTick: number;
  upperTick: number;
  lowerPrice: number;
  upperPrice: number;
  horizonDays: number;
  rebalanceMode: 'none' | 'periodic' | 'threshold' | 'volatility';
  rebalanceParams?: {
    periodDays?: number;
    priceThreshold?: number;
    volatilityThreshold?: number;
  };
  gasCostGwei: number;
  volumeScenario: 'low' | 'base' | 'high' | 'custom';
  customVolumeMultiplier?: number;
}

// ============================================================================
// Types
// ============================================================================

export interface EncodedStrategy {
  chain: string;
  pool: string;
  lower: string;
  upper: string;
  amount: string;
  token: string;
  horizon: string;
  rebalance: string;
  gas: string;
  name?: string;
}

export interface DecodedStrategy {
  chainId: number;
  poolAddress: string;
  lowerTick: number;
  upperTick: number;
  depositAmount: string;
  depositToken: 'token0' | 'token1' | 'usd';
  horizonDays: number;
  rebalanceMode: string;
  gasCostGwei: number;
  name?: string;
}

// ============================================================================
// URL Encoding
// ============================================================================

const PARAM_KEYS: Record<string, string> = {
  chain: 'c',
  pool: 'p',
  lower: 'l',
  upper: 'u',
  amount: 'a',
  token: 't',
  horizon: 'h',
  rebalance: 'r',
  gas: 'g',
  name: 'n',
};

const REVERSE_PARAM_KEYS = Object.fromEntries(
  Object.entries(PARAM_KEYS).map(([k, v]) => [v, k])
);

/**
 * Encode a strategy to a shareable URL
 * 
 * @param strategy - Saved strategy to encode
 * @returns Full URL string
 * 
 * @example
 * ```typescript
 * const url = encodeStrategyToURL(strategy);
 * // https://app.com/strategy?chain=1&pool=0x...&lower=100&upper=200...
 * ```
 */
export function encodeStrategyToURL(strategy: SavedStrategy): string {
  if (typeof window === 'undefined') {
    throw new Error('encodeStrategyToURL must be called in browser context');
  }

  const params = new URLSearchParams({
    [PARAM_KEYS.chain]: strategy.pool.chainId.toString(),
    [PARAM_KEYS.pool]: strategy.pool.address,
    [PARAM_KEYS.lower]: strategy.lowerTick.toString(),
    [PARAM_KEYS.upper]: strategy.upperTick.toString(),
    [PARAM_KEYS.amount]: strategy.depositAmount,
    [PARAM_KEYS.token]: strategy.depositToken,
    [PARAM_KEYS.horizon]: strategy.horizonDays.toString(),
    [PARAM_KEYS.rebalance]: strategy.rebalanceMode,
    [PARAM_KEYS.gas]: strategy.gasCostGwei.toString(),
  });

  // Add optional name if present
  if (strategy.name) {
    params.set(PARAM_KEYS.name, encodeURIComponent(strategy.name));
  }

  return `${window.location.origin}/strategy?${params.toString()}`;
}

/**
 * Encode strategy parameters to URL params (without pool object)
 * 
 * @param params - Strategy parameters
 * @param pool - Pool information
 * @returns URL search params string
 */
export function encodeStrategyParams(
  params: StrategyParams,
  pool: Pool
): string {
  if (typeof window === 'undefined') {
    throw new Error('encodeStrategyParams must be called in browser context');
  }

  const searchParams = new URLSearchParams({
    [PARAM_KEYS.chain]: pool.chainId.toString(),
    [PARAM_KEYS.pool]: pool.address,
    [PARAM_KEYS.lower]: params.lowerTick.toString(),
    [PARAM_KEYS.upper]: params.upperTick.toString(),
    [PARAM_KEYS.amount]: params.depositAmount,
    [PARAM_KEYS.token]: params.depositToken,
    [PARAM_KEYS.horizon]: params.horizonDays.toString(),
    [PARAM_KEYS.rebalance]: params.rebalanceMode,
    [PARAM_KEYS.gas]: params.gasCostGwei.toString(),
  });

  return searchParams.toString();
}

// ============================================================================
// URL Decoding
// ============================================================================

/**
 * Decode strategy from URL parameters
 * 
 * @returns Decoded strategy parameters or null if invalid
 * 
 * @example
 * ```typescript
 * const strategy = decodeStrategyFromURL();
 * if (strategy) {
 *   // Load the strategy
 * }
 * ```
 */
export function decodeStrategyFromURL(): DecodedStrategy | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  
  // Check for both long and short param keys
  const getParam = (longKey: string): string | null => {
    return params.get(longKey) || params.get(PARAM_KEYS[longKey]);
  };

  const chainId = getParam('chain');
  const poolAddress = getParam('pool');
  const lowerTick = getParam('lower');
  const upperTick = getParam('upper');
  const amount = getParam('amount');

  // Validate required parameters
  if (!chainId || !poolAddress || !lowerTick || !upperTick || !amount) {
    return null;
  }

  const depositToken = getParam('token') as 'token0' | 'token1' | 'usd';
  if (!['token0', 'token1', 'usd'].includes(depositToken)) {
    return null;
  }

  return {
    chainId: Number(chainId),
    poolAddress,
    lowerTick: Number(lowerTick),
    upperTick: Number(upperTick),
    depositAmount: amount,
    depositToken,
    horizonDays: Number(getParam('horizon')) || 30,
    rebalanceMode: getParam('rebalance') || 'none',
    gasCostGwei: Number(getParam('gas')) || 20,
    name: getParam('name') ? decodeURIComponent(getParam('name')!) : undefined,
  };
}

/**
 * Decode strategy from URL string (server-side safe)
 * 
 * @param url - URL string to decode from
 * @returns Decoded strategy parameters or null if invalid
 */
export function decodeStrategyFromString(url: string): DecodedStrategy | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const getParam = (longKey: string): string | null => {
      return params.get(longKey) || params.get(PARAM_KEYS[longKey]);
    };

    const chainId = getParam('chain');
    const poolAddress = getParam('pool');
    const lowerTick = getParam('lower');
    const upperTick = getParam('upper');
    const amount = getParam('amount');

    if (!chainId || !poolAddress || !lowerTick || !upperTick || !amount) {
      return null;
    }

    const depositToken = getParam('token') as 'token0' | 'token1' | 'usd';
    if (!['token0', 'token1', 'usd'].includes(depositToken)) {
      return null;
    }

    return {
      chainId: Number(chainId),
      poolAddress,
      lowerTick: Number(lowerTick),
      upperTick: Number(upperTick),
      depositAmount: amount,
      depositToken,
      horizonDays: Number(getParam('horizon')) || 30,
      rebalanceMode: getParam('rebalance') || 'none',
      gasCostGwei: Number(getParam('gas')) || 20,
      name: getParam('name') ? decodeURIComponent(getParam('name')!) : undefined,
    };
  } catch (error) {
    console.error('Failed to decode strategy from URL:', error);
    return null;
  }
}

// ============================================================================
// Clipboard & Sharing
// ============================================================================

/**
 * Copy strategy URL to clipboard
 * 
 * @param strategy - Strategy to share
 * @returns Promise that resolves when copied
 */
export async function copyStrategyToClipboard(
  strategy: SavedStrategy
): Promise<void> {
  const url = encodeStrategyToURL(strategy);
  
  try {
    await navigator.clipboard.writeText(url);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Failed to copy strategy URL to clipboard');
  }
}

/**
 * Share strategy using Web Share API (mobile)
 * 
 * @param strategy - Strategy to share
 * @returns Promise that resolves when shared
 */
export async function shareStrategy(strategy: SavedStrategy): Promise<void> {
  const url = encodeStrategyToURL(strategy);
  const title = `UniV3 Strategy: ${strategy.name || 'LP Position'}`;
  const text = `Check out this Uniswap V3 LP strategy: ${strategy.pool.token0.symbol}/${strategy.pool.token1.symbol}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url,
      });
    } catch (error) {
      // User cancelled or share failed, fallback to clipboard
      await copyStrategyToClipboard(strategy);
    }
  } else {
    // Fallback to clipboard
    await copyStrategyToClipboard(strategy);
  }
}

/**
 * Generate QR code data URL for strategy
 * 
 * @param strategy - Strategy to encode
 * @returns QR code data URL (requires QR code library)
 */
export function generateStrategyQRData(strategy: SavedStrategy): string {
  return encodeStrategyToURL(strategy);
}

// ============================================================================
// URL Management
// ============================================================================

/**
 * Update browser URL with current strategy params (without page reload)
 * 
 * @param params - Strategy parameters
 * @param pool - Pool information
 */
export function updateBrowserURL(params: StrategyParams, pool: Pool): void {
  if (typeof window === 'undefined') return;

  const searchParams = encodeStrategyParams(params, pool);
  const newUrl = `${window.location.pathname}?${searchParams}`;
  
  window.history.replaceState({}, '', newUrl);
}

/**
 * Clear strategy params from URL
 */
export function clearStrategyURL(): void {
  if (typeof window === 'undefined') return;
  
  window.history.replaceState({}, '', window.location.pathname);
}

/**
 * Check if URL contains valid strategy params
 */
export function hasStrategyParams(): boolean {
  if (typeof window === 'undefined') return false;
  
  const params = new URLSearchParams(window.location.search);
  return params.has('chain') || params.has(PARAM_KEYS.chain);
}

// ============================================================================
// Compression (for shorter URLs)
// ============================================================================

/**
 * Compress strategy params to base64 (shorter but less readable)
 * 
 * @param strategy - Strategy to compress
 * @returns Base64 encoded string
 */
export function compressStrategy(strategy: SavedStrategy): string {
  const data = {
    c: strategy.pool.chainId,
    p: strategy.pool.address,
    l: strategy.lowerTick,
    u: strategy.upperTick,
    a: strategy.depositAmount,
    t: strategy.depositToken,
    h: strategy.horizonDays,
    r: strategy.rebalanceMode,
    g: strategy.gasCostGwei,
    n: strategy.name,
  };

  const json = JSON.stringify(data);
  const compressed = btoa(json);
  
  return compressed;
}

/**
 * Decompress strategy from base64
 * 
 * @param compressed - Base64 encoded string
 * @returns Decoded strategy parameters
 */
export function decompressStrategy(compressed: string): DecodedStrategy | null {
  try {
    const json = atob(compressed);
    const data = JSON.parse(json);

    return {
      chainId: data.c,
      poolAddress: data.p,
      lowerTick: data.l,
      upperTick: data.u,
      depositAmount: data.a,
      depositToken: data.t,
      horizonDays: data.h,
      rebalanceMode: data.r,
      gasCostGwei: data.g,
      name: data.n,
    };
  } catch (error) {
    console.error('Failed to decompress strategy:', error);
    return null;
  }
}

/**
 * Generate short shareable link (uses compressed format)
 * 
 * @param strategy - Strategy to encode
 * @returns Short URL
 */
export function generateShortLink(strategy: SavedStrategy): string {
  if (typeof window === 'undefined') {
    throw new Error('generateShortLink must be called in browser context');
  }

  const compressed = compressStrategy(strategy);
  return `${window.location.origin}/s/${compressed}`;
}
