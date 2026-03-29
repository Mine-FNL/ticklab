/**
 * Swap Data - Fetches swap/transaction data from DeFi Llama and public sources
 * No API key required - uses free endpoints
 */

export interface SwapRecord {
  id: string;
  timestamp: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Amount: string;
  token1Amount: string;
  usdValue: number;
  sender: string;
  hash: string;
}

export interface SwapStats {
  totalSwaps: number;
  totalVolumeUSD: number;
  avgSwapSizeUSD: number;
  uniqueTokens: number;
  topPairs: Array<{ pair: string; volume: number; swaps: number }>;
}

const CHAINS_DEFI_LLAMA: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  8453: 'base',
  10: 'optimism',
  137: 'polygon',
};

export async function fetchSwapStats(chainId: number): Promise<SwapStats> {
  const llamaKey = CHAINS_DEFI_LLAMA[chainId];
  if (!llamaKey) {
    return defaultSwapStats();
  }

  try {
    // DeFi Llama pools endpoint - free, no auth
    const poolsRes = await fetch(
      `https://api.llama.fi/pools/${llamaKey}`,
      { next: { revalidate: 60 } }
    );
    if (!poolsRes.ok) throw new Error('LLama pools fetch failed');

    const pools = await poolsRes.json();
    const now = Date.now() / 1000;
    const dayAgo = now - 86400;

    let totalVolume = 0;
    let totalSwaps = 0;
    const pairVolumes: Record<string, { volume: number; swaps: number }> = {};

    for (const pool of pools.slice(0, 50)) {
      const vol = parseFloat(pool.volumeUSD || 0);
      const poolSwaps = parseInt(pool.swapVolume || pool.swaps || 0, 10);
      totalVolume += vol;
      totalSwaps += poolSwaps;

      const pair = `${pool.token0?.symbol || '?'}/${pool.token1?.symbol || '?'}`;
      if (!pairVolumes[pair]) pairVolumes[pair] = { volume: 0, swaps: 0 };
      pairVolumes[pair].volume += vol;
      pairVolumes[pair].swaps += poolSwaps;
    }

    const topPairs = Object.entries(pairVolumes)
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, 10)
      .map(([pair, data]) => ({ pair, ...data }));

    return {
      totalSwaps,
      totalVolumeUSD: totalVolume,
      avgSwapSizeUSD: totalSwaps > 0 ? totalVolume / totalSwaps : 0,
      uniqueTokens: pools.slice(0, 50).reduce((acc: Set<string>, p: { token0?: { symbol?: string }; token1?: { symbol?: string } }) => {
        if (p.token0?.symbol) acc.add(p.token0.symbol);
        if (p.token1?.symbol) acc.add(p.token1.symbol);
        return acc;
      }, new Set()).size,
      topPairs,
    };
  } catch (err) {
    console.error('Swap stats fetch error:', err);
    return defaultSwapStats();
  }
}

function defaultSwapStats(): SwapStats {
  return {
    totalSwaps: 0,
    totalVolumeUSD: 0,
    avgSwapSizeUSD: 0,
    uniqueTokens: 0,
    topPairs: [],
  };
}

export function formatSwapVolume(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`;
  return `$${usd.toFixed(2)}`;
}
