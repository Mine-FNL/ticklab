'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { CHAIN_NAMES } from '@/lib/constants';
import { fetchChainTVL, formatTVL } from '@/lib/data/tvl';
import { fetchSwapStats, formatSwapVolume } from '@/lib/data/swap';
import { SlidersHorizontal, TrendingUp, Activity, BarChart3, AlertCircle, BarChart, GitBranch } from 'lucide-react';
import { StrategyBuilder } from '@/components/strategy/StrategyBuilder';
import { ScenarioChart } from '@/components/strategy/ScenarioChart';
import { RangeVisualizer } from '@/components/strategy/RangeVisualizer';
import { MonteCarloRunner } from '@/components/montecarlo/MonteCarloRunner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Pool } from '@/types/strategy';
import { sqrtPriceToTick } from '@/lib/lp-math';
import type { ScenarioResult } from '@/lib/scenarios';
import type { LPStrategy, ComparisonResult } from '@/lib/lp-vs-hodl';

export default function StrategyPage() {
  const { selectedChain, selectedPool, selectPool } = useAppStore();
  const [chainTVL, setChainTVL] = useState({ tvl: 0, change24h: 0 });
  const [swapStats, setSwapStats] = useState({ totalVolumeUSD: 0, totalSwaps: 0 });
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [calculatedRange, setCalculatedRange] = useState({ lowerTick: 0, upperTick: 0 });
  const [viewMode, setViewMode] = useState<'scenarios' | 'montecarlo'>('scenarios');
  const [poolStats, setPoolStats] = useState<{ strategy?: LPStrategy; comparison?: ComparisonResult }>({});

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

  const handleCalculate = (scenarios: any[]) => {
    setScenarios(scenarios);
  };

  const handleRangeCalculated = (lower: number, upper: number) => {
    setCalculatedRange({ lowerTick: lower, upperTick: upper });
  };

  const handleStrategyComplete = (strategy: LPStrategy, results: ComparisonResult) => {
    setPoolStats({ strategy, comparison: results });
  };

  const handleScenariosCalculated = (scenarios: ScenarioResult[], lowerTick: number, upperTick: number) => {
    setScenarios(scenarios);
    setCalculatedRange({ lowerTick, upperTick });
  };

  const currentTick = selectedPool ? sqrtPriceToTick(BigInt(selectedPool.currentSqrtPriceX96 ?? '0')) : 0;
  const currentPrice = selectedPool
    ? Math.pow(Number(BigInt(selectedPool.currentSqrtPriceX96 ?? '0')) / Number(BigInt(2 ** 96)), 2)
    : 0;

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

      {/* No pool selected state */}
      {!selectedPool ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Pool Selected</h3>
            <p className="text-sm text-zinc-400 text-center max-w-md mb-4">
              Select a pool from the{' '}
              <a href="/pools" className="text-emerald-400 hover:text-emerald-300">
                Pools page
              </a>{' '}
              to start building your LP strategy.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Strategy Builder */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {selectedPool.token0.symbol} / {selectedPool.token1.symbol}
                  <span className="text-xs text-zinc-500 font-normal">
                    {(selectedPool.feeTier / 10000).toFixed(2)}% fee tier
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">TVL</span>
                    <p className="font-mono text-white">${(selectedPool.tvlUSD ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">24h Volume</span>
                    <p className="font-mono text-white">${(selectedPool.volumeUSD24h ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Current Tick</span>
                    <p className="font-mono text-white">{currentTick}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Liquidity</span>
                    <p className="font-mono text-white">{selectedPool.currentLiquidity ?? '—'}</p>
                  </div>
                </div>

                {/* Data Quality Warning */}
                {(selectedPool.tvlUSD ?? 0) < 100000 && (
                  <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 mt-3">
                    <p className="text-yellow-400 text-sm">
                      ⚠️ Low liquidity pool (${((selectedPool.tvlUSD ?? 0) / 1000).toFixed(0)}K TVL). Data may be unreliable.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <StrategyBuilder
              pool={selectedPool}
              currentTick={currentTick}
              sqrtPrice={BigInt(selectedPool.currentSqrtPriceX96 ?? '0')}
              currentPrice={currentPrice}
              onStrategyComplete={handleStrategyComplete}
              onScenariosCalculated={handleScenariosCalculated}
            />
          </div>

          {/* Right column - Visualization */}
          <div className="space-y-6">
            {calculatedRange.lowerTick !== 0 && (
              <RangeVisualizer
                lowerTick={calculatedRange.lowerTick}
                upperTick={calculatedRange.upperTick}
                currentTick={currentTick}
                token0Symbol={selectedPool.token0.symbol}
                token1Symbol={selectedPool.token1.symbol}
              />
            )}
            
            {/* View Mode Tabs */}
            {scenarios.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'scenarios' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('scenarios')}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Scenarios
                </Button>
                <Button
                  variant={viewMode === 'montecarlo' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('montecarlo')}
                  className="flex items-center gap-2"
                >
                  <GitBranch className="w-4 h-4" />
                  Monte Carlo
                </Button>
              </div>
            )}
            
            {/* Scenario Analysis View */}
            {viewMode === 'scenarios' && scenarios.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Scenario Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScenarioChart
                    scenarios={scenarios}
                    entryPrice={currentPrice}
                  />
                </CardContent>
              </Card>
            )}
            
            {/* Monte Carlo View */}
            {viewMode === 'montecarlo' && scenarios.length > 0 && calculatedRange.lowerTick !== 0 && (
              <MonteCarloRunner
                entryPrice={currentPrice}
                lowerTick={calculatedRange.lowerTick}
                upperTick={calculatedRange.upperTick}
                poolTVL={selectedPool.tvlUSD ?? 0}
                feeTier={selectedPool.feeTier}
              />
            )}
            
            {!scenarios.length && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="w-10 h-10 text-zinc-600 mb-3" />
                  <p className="text-sm text-zinc-400">
                    Configure your strategy parameters and click &quot;Calculate Strategy&quot; 
                    to see scenario analysis
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
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
          <Skeleton className="h-7 w-24 mt-0.5" />
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
