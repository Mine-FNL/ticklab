'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fetchChainTVL, fetchPoolTVLs, formatTVL, PoolTVL } from '@/lib/data/tvl';
import { CHAIN_NAMES } from '@/lib/constants';
import { fetchGlobalTVL } from '@/lib/data/tvl';

export default function TVLPage() {
  const { selectedChain } = useAppStore();
  const [chainTVL, setChainTVL] = useState({ tvl: 0, change24h: 0 });
  const [globalTVL, setGlobalTVL] = useState({ total: 0, change24h: 0 });
  const [pools, setPools] = useState<PoolTVL[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchChainTVL(selectedChain),
      fetchPoolTVLs(selectedChain),
      fetchGlobalTVL(),
    ]).then(([chainData, poolsData, globalData]) => {
      setChainTVL(chainData);
      setPools(poolsData);
      setGlobalTVL(globalData);
      setLoading(false);
    });
  }, [selectedChain]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">TVL</h1>
        <p className="text-sm text-[#888] mt-1">
          Total Value Locked — {CHAIN_NAMES[selectedChain] || 'Unknown Chain'}
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Chain TVL"
          value={loading ? '—' : formatTVL(chainTVL.tvl)}
          change={chainTVL.change24h}
          loading={loading}
        />
        <MetricCard
          label="Global DeFi TVL"
          value={loading ? '—' : formatTVL(globalTVL.total)}
          loading={loading}
        />
        <MetricCard
          label="Pool Count"
          value={loading ? '—' : pools.length.toString()}
          loading={loading}
        />
        <MetricCard
          label="Top Pool TVL"
          value={
            loading
              ? '—'
              : pools[0]
              ? formatTVL(pools[0].tvlUSD)
              : '—'
          }
          loading={loading}
        />
      </div>

      {/* TVL by chain */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">Top Chains by TVL</span>
        </div>
        <ChainTVLTable currentChain={selectedChain} />
      </div>

      {/* Top pools by TVL */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Top Pools by TVL</span>
          <span className="text-xs text-[#555]">{CHAIN_NAMES[selectedChain]}</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(10)].map((_, i) => <PoolSkeleton key={i} />)}
            </div>
          ) : pools.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pool</th>
                  <th>TVL</th>
                  <th>1d Change</th>
                  <th>7d Change</th>
                  <th>24h Volume</th>
                  <th>24h Fees</th>
                </tr>
              </thead>
              <tbody>
                {pools.slice(0, 25).map((pool, i) => (
                  <tr key={pool.address}>
                    <td className="text-[#555] font-mono text-xs">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{pool.symbol}</span>
                      </div>
                    </td>
                    <td className="font-mono text-white">{formatTVL(pool.tvlUSD)}</td>
                    <td>
                      <span
                        className={`font-mono text-xs ${
                          pool.change1d >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}
                      >
                        {pool.change1d >= 0 ? '+' : ''}{pool.change1d.toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <span
                        className={`font-mono text-xs ${
                          pool.change7d >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}
                      >
                        {pool.change7d >= 0 ? '+' : ''}{pool.change7d.toFixed(2)}%
                      </span>
                    </td>
                    <td className="font-mono text-[#ccc]">{formatTVL(pool.volume24h)}</td>
                    <td className="font-mono text-[#ccc]">{formatTVL(pool.fees24h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-[#555] text-sm">
              No TVL data available for this chain.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChainTVLTable({ currentChain }: { currentChain: number }) {
  const [data, setData] = useState<
    Array<{ name: string; icon: string; tvl: number; change24h: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchChainTVL(1),
      fetchChainTVL(42161),
      fetchChainTVL(8453),
      fetchChainTVL(10),
      fetchChainTVL(137),
    ]).then(([eth, arb, base, op, poly]) => {
      setData([
        { name: 'Ethereum', icon: '🔷', tvl: eth.tvl, change24h: eth.change24h },
        { name: 'Arbitrum', icon: '🔵', tvl: arb.tvl, change24h: arb.change24h },
        { name: 'Base', icon: '🔷', tvl: base.tvl, change24h: base.change24h },
        { name: 'Optimism', icon: '🔴', tvl: op.tvl, change24h: op.change24h },
        { name: 'Polygon', icon: '🟣', tvl: poly.tvl, change24h: poly.change24h },
      ].sort((a, b) => b.tvl - a.tvl));
      setLoading(false);
    });
  }, []);

  return (
    <div className="overflow-x-auto">
      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-4 w-24 ml-auto" />
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Chain</th>
              <th>TVL</th>
              <th>24h Change</th>
            </tr>
          </thead>
          <tbody>
            {data.map((chain) => (
              <tr key={chain.name} className={currentChain === [1, 42161, 8453, 10, 137][[
                'Ethereum', 'Arbitrum', 'Base', 'Optimism', 'Polygon'
              ].indexOf(chain.name)] ? 'bg-[#1f1f1f]' : ''}>
                <td>
                  <div className="flex items-center gap-2">
                    <span>{chain.icon}</span>
                    <span className="text-white font-medium">{chain.name}</span>
                  </div>
                </td>
                <td className="font-mono text-white">{formatTVL(chain.tvl)}</td>
                <td>
                  <span
                    className={`font-mono text-xs ${
                      chain.change24h >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                    }`}
                  >
                    {chain.change24h >= 0 ? '+' : ''}{chain.change24h.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  loading,
}: {
  label: string;
  value: string;
  change?: number;
  loading: boolean;
}) {
  return (
    <div className="card card-body">
      <div className="metric-label">{label}</div>
      {loading ? (
        <div className="skeleton h-8 w-28 mt-1" />
      ) : (
        <div className="metric-value mt-1">{value}</div>
      )}
      {change !== undefined && !loading && (
        <div className={`metric-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

function PoolSkeleton() {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="skeleton h-4 w-6" />
      <div className="skeleton h-4 w-36" />
      <div className="skeleton h-4 w-20 ml-auto" />
      <div className="skeleton h-4 w-16" />
      <div className="skeleton h-4 w-16" />
    </div>
  );
}
