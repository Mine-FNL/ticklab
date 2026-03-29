'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fetchPoolTVLs, formatTVL } from '@/lib/data/tvl';
import { CHAIN_NAMES } from '@/lib/constants';
import { PoolTVL } from '@/lib/data/tvl';

export default function ExplorePage() {
  const { selectedChain } = useAppStore();
  const [pools, setPools] = useState<PoolTVL[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPoolTVLs(selectedChain).then((data) => {
      setPools(data);
      setLoading(false);
    });
  }, [selectedChain]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Explore Pools</h1>
        <p className="text-sm text-[#888] mt-1">
          Uniswap V3 pools on {CHAIN_NAMES[selectedChain] || 'Unknown Chain'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pools" value={loading ? '—' : pools.length.toString()} loading={loading} />
        <StatCard label="Total TVL" value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.tvlUSD, 0))} loading={loading} />
        <StatCard label="24h Volume" value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.volume24h, 0))} loading={loading} />
        <StatCard label="24h Fees" value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.fees24h, 0))} loading={loading} />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-4 w-20 ml-auto" />
                  <div className="skeleton h-4 w-20" />
                </div>
              ))}
            </div>
          ) : pools.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pool</th>
                  <th>TVL</th>
                  <th>24h Volume</th>
                  <th>24h Fees</th>
                  <th>1d Change</th>
                </tr>
              </thead>
              <tbody>
                {pools.slice(0, 20).map((pool) => (
                  <tr key={pool.address}>
                    <td className="text-white font-medium">{pool.symbol}</td>
                    <td className="font-mono">{formatTVL(pool.tvlUSD)}</td>
                    <td className="font-mono text-[#ccc]">{formatTVL(pool.volume24h)}</td>
                    <td className="font-mono text-[#ccc]">{formatTVL(pool.fees24h)}</td>
                    <td>
                      <span className={`font-mono text-xs ${pool.change1d >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {pool.change1d >= 0 ? '+' : ''}{pool.change1d.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-[#555] text-sm">
              No pools found for this chain.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="card card-body">
      <div className="metric-label">{label}</div>
      {loading ? <div className="skeleton h-8 w-24 mt-1" /> : <div className="metric-value mt-1">{value}</div>}
    </div>
  );
}
