/**
 * TVL Data - Fetches Total Value Locked data from DeFi Llama
 * No API key required - uses free endpoints
 */

export interface TVLDataPoint {
  timestamp: number;
  tvlUSD: number;
}

export interface PoolTVL {
  address: string;
  symbol: string;
  feeTier: number;
  tvlUSD: number;
  change1d: number;
  change7d: number;
  volume24h: number;
  fees24h: number;
  apy: number;
}

const CHAINS_DEFI_LLAMA: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  8453: 'base',
  10: 'optimism',
  137: 'polygon',
};

export async function fetchGlobalTVL(): Promise<{ total: number; change24h: number }> {
  try {
    const res = await fetch('https://api.llama.fi/tvl', {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('TVL fetch failed');
    const data = await res.json();
    const total = typeof data === 'number' ? data : data.total || 0;

    // Estimate 24h change (simplified)
    return { total, change24h: 0 };
  } catch {
    return { total: 0, change24h: 0 };
  }
}

export async function fetchChainTVL(chainId: number): Promise<{ tvl: number; change24h: number }> {
  const llv2Key = CHAINS_DEFI_LLAMA[chainId];
  if (!llv2Key) return { tvl: 0, change24h: 0 };

  try {
    const res = await fetch(`https://api.llama.fi/v2/historicalChainTvl/${llv2Key}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('Chain TVL fetch failed');
    const data = await res.json();

    const timestamps = Object.keys(data).map(Number).sort((a, b) => a - b);
    if (timestamps.length < 2) return { tvl: 0, change24h: 0 };

    const now = timestamps[timestamps.length - 1];
    const dayAgo = now - 86400;
    const closestDayAgo = timestamps.reduce((prev, curr) =>
      Math.abs(curr - dayAgo) < Math.abs(prev - dayAgo) ? curr : prev
    );

    const currentTVL = data[now];
    const prevTVL = data[closestDayAgo];
    const change24h = prevTVL > 0 ? ((currentTVL - prevTVL) / prevTVL) * 100 : 0;

    return { tvl: currentTVL, change24h };
  } catch (err) {
    console.error('Chain TVL fetch error:', err);
    return { tvl: 0, change24h: 0 };
  }
}

function parseFeeTier(poolMeta?: string): number {
  if (!poolMeta) return 0;
  const match = poolMeta.match(/([\d.]+)%/);
  if (!match) return 0;
  return Math.round(parseFloat(match[1]) * 10000);
}

export async function fetchPoolTVLs(chainId: number): Promise<PoolTVL[]> {
  const llv2Key = CHAINS_DEFI_LLAMA[chainId];
  if (!llv2Key) return [];

  try {
    const res = await fetch(
      `https://api.llama.fi/pools/${llv2Key}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error('Pools fetch failed');
    const pools = await res.json();

    return pools
      .filter((p: { protocol?: string; poolMeta?: string }) => p.protocol?.toLowerCase().includes('uniswap') || p.poolMeta?.toLowerCase().includes('v3'))
      .slice(0, 50)
      .map((p: { address?: string; symbol?: string; tvlUsd?: number; change1d?: number; change7d?: number; volumeUsd?: number; feesUsd?: number; apy?: number; poolMeta?: string }) => ({
        address: p.address || '',
        symbol: p.symbol || '—',
        feeTier: parseFeeTier(p.poolMeta),
        tvlUSD: p.tvlUsd || 0,
        change1d: p.change1d || 0,
        change7d: p.change7d || 0,
        volume24h: p.volumeUsd || 0,
        fees24h: p.feesUsd || 0,
        apy: p.apy || 0,
      }))
      .sort((a: PoolTVL, b: PoolTVL) => b.tvlUSD - a.tvlUSD);
  } catch (err) {
    console.error('Pool TVLs fetch error:', err);
    return [];
  }
}

export function formatTVL(usd: number): string {
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`;
  return `$${usd.toFixed(2)}`;
}
