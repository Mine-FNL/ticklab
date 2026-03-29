'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { CHAIN_NAMES } from '@/lib/constants';
import { fetchChainTVL, formatTVL } from '@/lib/data/tvl';
import { fetchSwapStats, formatSwapVolume } from '@/lib/data/swap';
import { SlidersHorizontal, TrendingUp, Activity, BarChart3 } from 'lucide-react';

export default function StrategyPage() {
  const { selectedChain } = useAppStore();
  const [chainTVL, setChainTVL] = useState({ tvl: 0, change24h: 0 });
  const [swapStats, setSwapStats] = useState({ totalVolumeUSD: 0, totalSwaps: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchChainTVL(selectedChain),
      fetchSwapStats(selectedChain),
    ]).then(([tvlData, swapData]) => {
      setChainTVL(tvlData);
      setSwapStats({ totalVolumeUSD: swapData.totalVolumeUSD, totalSwaps: swapData.totalSwaps });
      setLoading(false);
    });
  }, [selectedChain]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Strategy Builder</h1>
        <p className="text-sm text-[#888] mt-1">
          Build and backtest Uniswap V3 LP strategies on {CHAIN_NAMES[selectedChain] || 'Ethereum'}
        </p>
      </div>

      {/* Chain stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <DashboardCard
          icon={<BarChart3 className="w-4 h-4 text-[#10b981]" />}
          label="Chain TVL"
          value={loading ? '—' : formatTVL(chainTVL.tvl)}
          sub={chainTVL.change24h !== 0 ? `${chainTVL.change24h >= 0 ? '+' : ''}${chainTVL.change24h.toFixed(2)}%` : undefined}
          loading={loading}
        />
        <DashboardCard
          icon={<Activity className="w-4 h-4 text-[#3b82f6]" />}
          label="24h Volume"
          value={loading ? '—' : formatSwapVolume(swapStats.totalVolumeUSD)}
          loading={loading}
        />
        <DashboardCard
          icon={<TrendingUp className="w-4 h-4 text-[#f59e0b]" />}
          label="24h Swaps"
          value={loading ? '—' : swapStats.totalSwaps.toLocaleString()}
          loading={loading}
        />
        <DashboardCard
          icon={<SlidersHorizontal className="w-4 h-4 text-[#888]" />}
          label="Chain"
          value={CHAIN_NAMES[selectedChain] || '—'}
          loading={false}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <QuickActionCard
          title="New Strategy"
          desc="Create a new concentrated liquidity position with custom price range and fee tier."
          href="/strategy"
          cta="Build Strategy"
        />
        <QuickActionCard
          title="Backtest"
          desc="Run historical simulations to see how your strategy would have performed."
          href="/backtest"
          cta="Run Backtest"
        />
        <QuickActionCard
          title="Explore Pools"
          desc="Browse top Uniswap V3 pools and analyze their historical performance."
          href="/pools"
          cta="Explore Pools"
        />
      </div>

      {/* Strategy builder form */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Strategy Parameters</span>
          <span className="text-xs text-[#555]">Configure your LP position</span>
        </div>
        <div className="p-6">
          <StrategyForm />
        </div>
      </div>
    </div>
  );
}

function DashboardCard({
  icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
}) {
  return (
    <div className="card card-body flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="metric-label">{label}</div>
        {loading ? (
          <div className="skeleton h-7 w-24 mt-0.5" />
        ) : (
          <div className="metric-value mt-0.5">{value}</div>
        )}
        {sub && !loading && (
          <div className={`metric-change ${parseFloat(sub) >= 0 ? 'positive' : 'negative'}`}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="card card-body flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <p className="text-xs text-[#888] mt-1 leading-relaxed">{desc}</p>
      </div>
      <a
        href={href}
        className="btn btn-primary text-center inline-block mt-auto"
      >
        {cta}
      </a>
    </div>
  );
}

function StrategyForm() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <FormField label="Token Pair" hint="Select pool">
        <select className="select">
          <option>ETH / USDC</option>
          <option>WBTC / ETH</option>
          <option>USDC / USDT</option>
        </select>
      </FormField>
      <FormField label="Fee Tier" hint="Pool fee tier">
        <select className="select">
          <option value="3000">0.3% — Most Common</option>
          <option value="500">0.05% — Low Vol</option>
          <option value="10000">1% — High Fee</option>
          <option value="100">0.01% — Stable</option>
        </select>
      </FormField>
      <FormField label="Lower Price" hint="Price or tick">
        <input type="text" placeholder="e.g. 1800 or tick -500" className="input font-mono" />
      </FormField>
      <FormField label="Upper Price" hint="Price or tick">
        <input type="text" placeholder="e.g. 2200 or tick +500" className="input font-mono" />
      </FormField>
      <FormField label="Deposit Amount" hint="In USD equivalent">
        <input type="number" placeholder="1000" className="input font-mono" />
      </FormField>
      <FormField label="Gas Price (Gwei)" hint="For fee estimation">
        <input type="number" placeholder="20" defaultValue="20" className="input font-mono" />
      </FormField>
      <FormField label="Horizon (Days)" hint="Simulation length">
        <input type="number" placeholder="30" defaultValue="30" className="input font-mono" />
      </FormField>
      <FormField label="Volume Scenario" hint="Swap volume estimate">
        <select className="select">
          <option value="base">Base (current)</option>
          <option value="low">Low (-50%)</option>
          <option value="high">High (+100%)</option>
        </select>
      </FormField>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-[#888] mb-1.5">
        {label} <span className="text-[#555]">({hint})</span>
      </label>
      {children}
    </div>
  );
}
