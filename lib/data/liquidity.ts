/**
 * Liquidity Data - Fetches liquidity distribution data
 * Uses DeFi Llama pools API (free, no key)
 */

export interface LiquidityDistribution {
  tick: number;
  liquidity: number;
  tvlUSD: number;
}

export interface PoolLiquidity {
  address: string;
  symbol: string;
  totalLiquidityUSD: number;
  activeLiquidityUSD: number;
  inactiveLiquidityUSD: number;
  numPositions: number;
  feeTier: number;
  volume24h: number;
  fees24h: number;
  utilization: number;
}

const CHAINS_DEFI_LLAMA: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  8453: 'base',
  10: 'optimism',
  137: 'polygon',
};

export async function fetchPoolLiquidity(chainId: number): Promise<PoolLiquidity[]> {
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
      .filter((p: { protocol?: string; poolMeta?: string }) =>
        p.protocol?.toLowerCase().includes('uniswap') ||
        p.poolMeta?.toLowerCase().includes('v3')
      )
      .slice(0, 50)
      .map((p: { address?: string; symbol?: string; tvlUsd?: number; volumeUsd?: number; feesUsd?: number; fee?: number; utilization?: number }) => ({
        address: p.address || '',
        symbol: p.symbol || '—',
        totalLiquidityUSD: p.tvlUsd || 0,
        activeLiquidityUSD: (p.tvlUsd || 0) * (p.utilization || 0.5),
        inactiveLiquidityUSD: (p.tvlUsd || 0) * (1 - (p.utilization || 0.5)),
        numPositions: 0,
        feeTier: p.fee || 3000,
        volume24h: p.volumeUsd || 0,
        fees24h: p.feesUsd || 0,
        utilization: p.utilization || 0,
      }))
      .sort((a: PoolLiquidity, b: PoolLiquidity) => b.totalLiquidityUSD - a.totalLiquidityUSD);
  } catch (err) {
    console.error('Liquidity fetch error:', err);
    return [];
  }
}

export async function fetchLiquidityDistribution(
  chainId: number,
  poolAddress?: string
): Promise<LiquidityDistribution[]> {
  // Return mock distribution data since getting full tick data requires subgraph
  const mock: LiquidityDistribution[] = [];
  const baseLiq = 1_000_000;
  for (let i = -50; i <= 50; i++) {
    const gaussian = Math.exp(-(i * i) / 200);
    mock.push({
      tick: i * 60,
      liquidity: baseLiq * gaussian,
      tvlUSD: baseLiq * gaussian,
    });
  }
  return mock;
}

export function formatLiquidity(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`;
  return `$${usd.toFixed(0)}`;
}
