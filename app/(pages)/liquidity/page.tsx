'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fetchPoolLiquidity, formatLiquidity, PoolLiquidity } from '@/lib/data/liquidity';
import { CHAIN_NAMES } from '@/lib/constants';

export default function LiquidityPage() {
  const { selectedChain } = useAppStore();
  const [pools, setPools] = useState<PoolLiquidity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof PoolLiquidity>('totalLiquidityUSD');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    fetchPoolLiquidity(selectedChain).then((data) => {
      setPools(data);
      setLoading(false);
    });
  }, [selectedChain]);

  const sorted = [...pools].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const handleSort = (key: keyof PoolLiquidity) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }: { col: keyof PoolLiquidity }) =>
    sortKey === col ? (
      <span className="ml-1 text-[#10b981]">{sortDir === 'desc' ? '↓' : '↑'}</span>
    ) : null;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Liquidity</h1>
        <p className="text-sm text-[#888] mt-1">
          Liquidity analytics for Uniswap V3 on {CHAIN_NAMES[selectedChain] || 'Unknown Chain'}
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Total Liquidity"
          value={loading ? '—' : formatLiquidity(pools.reduce((s, p) => s + p.totalLiquidityUSD, 0))}
          loading={loading}
        />
        <MetricCard
          label="Active Liquidity"
          value={loading ? '—' : formatLiquidity(pools.reduce((s, p) => s + p.activeLiquidityUSD, 0))}
          loading={loading}
        />
        <MetricCard
          label="24h Volume"
          value={loading ? '—' : formatLiquidity(pools.reduce((s, p) => s + p.volume24h, 0))}
          loading={loading}
        />
        <MetricCard
          label="24h Fees"
          value={loading ? '—' : formatLiquidity(pools.reduce((s, p) => s + p.fees24h, 0))}
          loading={loading}
        />
      </div>

      {/* Liquidity table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Pool Liquidity Breakdown</span>
          <span className="text-xs text-[#555]">Click column headers to sort</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(12)].map((_, i) => <LiquiditySkeleton key={i} />)}
            </div>
          ) : sorted.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pool</th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('totalLiquidityUSD')}
                  >
                    Total TVL <SortIcon col="totalLiquidityUSD" />
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('activeLiquidityUSD')}
                  >
                    Active <SortIcon col="activeLiquidityUSD" />
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('inactiveLiquidityUSD')}
                  >
                    Inactive <SortIcon col="inactiveLiquidityUSD" />
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('utilization')}
                  >
                    Utilization <SortIcon col="utilization" />
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('feeTier')}
                  >
                    Fee Tier <SortIcon col="feeTier" />
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('volume24h')}
                  >
                    24h Vol <SortIcon col="volume24h" />
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('fees24h')}
                  >
                    24h Fees <SortIcon col="fees24h" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((pool, i) => (
                  <tr key={pool.address}>
                    <td className="text-[#555] font-mono text-xs">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{pool.symbol}</span>
                      </div>
                    </td>
                    <td className="font-mono text-white">
                      {formatLiquidity(pool.totalLiquidityUSD)}
                    </td>
                    <td className="font-mono text-[#10b981]">
                      {formatLiquidity(pool.activeLiquidityUSD)}
                    </td>
                    <td className="font-mono text-[#888]">
                      {formatLiquidity(pool.inactiveLiquidityUSD)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#10b981] rounded-full"
                            style={{ width: `${Math.min(pool.utilization * 100, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-[#ccc]">
                          {(pool.utilization * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-blue">
                        {pool.feeTier / 10000}%
                      </span>
                    </td>
                    <td className="font-mono text-[#ccc]">
                      {formatLiquidity(pool.volume24h)}
                    </td>
                    <td className="font-mono text-[#ccc]">
                      {formatLiquidity(pool.fees24h)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-[#555] text-sm">
              No liquidity data available for this chain.
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
        <div className="skeleton h-8 w-28 mt-1" />
      ) : (
        <div className="metric-value mt-1">{value}</div>
      )}
    </div>
  );
}

function LiquiditySkeleton() {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="skeleton h-4 w-6" />
      <div className="skeleton h-4 w-40" />
      <div className="skeleton h-4 w-20 ml-auto" />
      <div className="skeleton h-4 w-20" />
      <div className="skeleton h-4 w-20" />
      <div className="skeleton h-4 w-20" />
    </div>
  );
}
