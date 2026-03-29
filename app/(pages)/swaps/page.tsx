'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fetchSwapStats, formatSwapVolume } from '@/lib/data/swap';
import { CHAIN_NAMES } from '@/lib/constants';

export default function SwapsPage() {
  const { selectedChain } = useAppStore();
  const [stats, setStats] = useState<{
    totalSwaps: number;
    totalVolumeUSD: number;
    avgSwapSizeUSD: number;
    uniqueTokens: number;
    topPairs: Array<{ pair: string; volume: number; swaps: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSwapStats(selectedChain).then((data) => {
      setStats(data);
      setLoading(false);
    });
  }, [selectedChain]);

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Swaps</h1>
        <p className="text-sm text-[#888] mt-1">
          Uniswap V3 swap analytics on {CHAIN_NAMES[selectedChain] || 'Unknown Chain'}
        </p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Total Volume (24h)"
          value={stats ? formatSwapVolume(stats.totalVolumeUSD) : '—'}
          loading={loading}
        />
        <MetricCard
          label="Total Swaps"
          value={stats ? stats.totalSwaps.toLocaleString() : '—'}
          loading={loading}
        />
        <MetricCard
          label="Avg Swap Size"
          value={stats ? formatSwapVolume(stats.avgSwapSizeUSD) : '—'}
          loading={loading}
        />
        <MetricCard
          label="Unique Tokens"
          value={stats ? stats.uniqueTokens.toLocaleString() : '—'}
          loading={loading}
        />
      </div>

      {/* Top pairs table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Top Trading Pairs</span>
          <span className="text-xs text-[#555]">by 24h volume</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : stats && stats.topPairs.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pair</th>
                  <th>Volume (24h)</th>
                  <th>Swaps</th>
                  <th>Avg Size</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPairs.map((pair, i) => (
                  <tr key={pair.pair}>
                    <td className="text-[#555] font-mono">{i + 1}</td>
                    <td>
                      <span className="text-white font-medium">{pair.pair}</span>
                    </td>
                    <td className="font-mono text-white">
                      {formatSwapVolume(pair.volume)}
                    </td>
                    <td className="font-mono text-[#ccc]">
                      {pair.swaps.toLocaleString()}
                    </td>
                    <td className="font-mono text-[#888]">
                      {formatSwapVolume(pair.volume / Math.max(pair.swaps, 1))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-[#555] text-sm">
              No swap data available for this chain.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  loading,
  change,
}: {
  label: string;
  value: string;
  loading: boolean;
  change?: string;
}) {
  return (
    <div className="card card-body">
      <div className="metric-label">{label}</div>
      {loading ? (
        <div className="skeleton h-8 w-24 mt-1" />
      ) : (
        <div className="metric-value mt-1">{value}</div>
      )}
      {change && !loading && (
        <div className={`metric-change ${parseFloat(change) >= 0 ? 'positive' : 'negative'}`}>
          {parseFloat(change) >= 0 ? '+' : ''}{change}%
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4">
      <div className="skeleton h-4 w-8" />
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-4 w-24 ml-auto" />
      <div className="skeleton h-4 w-16" />
    </div>
  );
}
