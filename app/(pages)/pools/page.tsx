'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fetchPoolTVLs, formatTVL } from '@/lib/data/tvl';
import { CHAIN_NAMES } from '@/lib/constants';
import { PoolTVL } from '@/lib/data/tvl';

export default function PoolsPage() {
  const { selectedChain } = useAppStore();
  const [pools, setPools] = useState<PoolTVL[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchPoolTVLs(selectedChain).then((data) => {
      setPools(data);
      setLoading(false);
    });
  }, [selectedChain]);

  const filtered = pools.filter((p) =>
    p.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Pools</h1>
          <p className="text-sm text-[#888] mt-1">
            Uniswap V3 pools on {CHAIN_NAMES[selectedChain] || 'Unknown Chain'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="live-indicator">Live</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search pools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Total Pools"
          value={loading ? '—' : pools.length.toString()}
          loading={loading}
        />
        <MetricCard
          label="Total TVL"
          value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.tvlUSD, 0))}
          loading={loading}
        />
        <MetricCard
          label="24h Volume"
          value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.volume24h, 0))}
          loading={loading}
        />
        <MetricCard
          label="24h Fees"
          value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.fees24h, 0))}
          loading={loading}
        />
      </div>

      {/* Pools table */}
      <div className="card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(12)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : filtered.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pool</th>
                  <th>Fee Tier</th>
                  <th>TVL</th>
                  <th>24h Volume</th>
                  <th>24h Fees</th>
                  <th>APY</th>
                  <th>1d Change</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pool, i) => (
                  <tr key={pool.address}>
                    <td className="text-[#555] font-mono text-xs">{i + 1}</td>
                    <td>
                      <span className="text-white font-medium">{pool.symbol}</span>
                    </td>
                    <td>
                      <span className="badge badge-blue">
                        {pool.feeTier / 10000}%
                      </span>
                    </td>
                    <td className="font-mono text-white">{formatTVL(pool.tvlUSD)}</td>
                    <td className="font-mono text-[#ccc]">{formatTVL(pool.volume24h)}</td>
                    <td className="font-mono text-[#ccc]">{formatTVL(pool.fees24h)}</td>
                    <td className="font-mono text-[#10b981]">
                      {pool.apy > 0 ? `${pool.apy.toFixed(2)}%` : '—'}
                    </td>
                    <td>
                      <span
                        className={`font-mono text-xs ${
                          pool.change1d >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}
                      >
                        {pool.change1d >= 0 ? '+' : ''}{pool.change1d.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-[#555] text-sm">
              {search ? 'No pools match your search.' : 'No pool data available for this chain.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="card card-body">
      <div className="metric-label">{label}</div>
      {loading ? (
        <div className="skeleton h-8 w-24 mt-1" />
      ) : (
        <div className="metric-value mt-1">{value}</div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="skeleton h-4 w-6" />
      <div className="skeleton h-4 w-40" />
      <div className="skeleton h-4 w-12" />
      <div className="skeleton h-4 w-20 ml-auto" />
      <div className="skeleton h-4 w-20" />
      <div className="skeleton h-4 w-16" />
    </div>
  );
}
