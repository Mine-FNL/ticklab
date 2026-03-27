/**
 * PoolMetrics Component
 * 
 * Detailed pool metrics display with historical data.
 */

'use client';

import React from 'react';
import { TrendingUp, Droplets, DollarSign, BarChart3, Activity, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Pool, PoolState } from '@/types';

export interface PoolMetricsProps {
  pool: Pool;
  state: PoolState;
  historical?: {
    volume7d: number;
    fees7d: number;
    avgLiquidity: number;
  };
  className?: string;
}

// Fee tier labels
const feeTierLabels: Record<number, string> = {
  100: '0.01%',
  500: '0.05%',
  3000: '0.3%',
  10000: '1%',
};

/**
 * Format large USD numbers
 */
function formatUSD(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * Format large numbers
 */
function formatNumber(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

/**
 * PoolMetrics - Detailed pool metrics display
 * 
 * @example
 * ```tsx
 * <PoolMetrics 
 *   pool={pool}
 *   state={poolState}
 *   historical={{ volume7d: 35000000, fees7d: 105000, avgLiquidity: 45000000 }}
 * />
 * ```
 */
export function PoolMetrics({
  pool,
  state,
  historical,
  className,
}: PoolMetricsProps) {
  // Calculate derived metrics
  const utilization24h = historical 
    ? (historical.volume7d / 7 / historical.avgLiquidity) * 100 
    : 0;

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center 
                              border-2 border-zinc-800 text-sm font-bold">
                {pool.token0.symbol.slice(0, 2)}
              </div>
              <div className="w-10 h-10 rounded-full bg-zinc-600 flex items-center justify-center 
                              border-2 border-zinc-800 text-sm font-bold">
                {pool.token1.symbol.slice(0, 2)}
              </div>
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-zinc-100">
                {pool.token0.symbol}/{pool.token1.symbol}
              </CardTitle>
              <p className="text-sm text-zinc-500">
                Fee: {feeTierLabels[pool.feeTier] || `${pool.feeTier / 10000}%`} • 
                Tick Spacing: {pool.tickSpacing}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current state */}
        <div className="p-4 bg-zinc-800/50 rounded-xl">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Current State
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Current Tick</p>
              <p className="font-mono text-zinc-200">{state.tick}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Liquidity</p>
              <p className="font-mono text-zinc-200">
                {formatNumber(parseFloat(state.liquidity))}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Observation Index</p>
              <p className="font-mono text-zinc-200">{state.observationIndex}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Cardinality</p>
              <p className="font-mono text-zinc-200">{state.observationCardinality}</p>
            </div>
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Key metrics */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Key Metrics
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricItem
              icon={Droplets}
              label="Total Liquidity"
              value={formatNumber(parseFloat(pool.liquidity))}
            />
            <MetricItem
              icon={Activity}
              label="Utilization (24h)"
              value={`${utilization24h.toFixed(2)}%`}
              valueClassName={utilization24h > 50 ? 'text-emerald-400' : 'text-zinc-300'}
            />
            <MetricItem
              icon={BarChart3}
              label="Tick Spacing"
              value={pool.tickSpacing.toString()}
            />
            <MetricItem
              icon={Clock}
              label="Fee Protocol"
              value={state.feeProtocol.toString()}
            />
          </div>
        </div>

        {/* Historical metrics */}
        {historical && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                7-Day Historical
              </p>
              <div className="grid grid-cols-3 gap-4">
                <MetricItem
                  icon={TrendingUp}
                  label="Volume (7d)"
                  value={formatUSD(historical.volume7d)}
                />
                <MetricItem
                  icon={DollarSign}
                  label="Fees (7d)"
                  value={formatUSD(historical.fees7d)}
                />
                <MetricItem
                  icon={Droplets}
                  label="Avg Liquidity"
                  value={formatUSD(historical.avgLiquidity)}
                />
              </div>
            </div>
          </>
        )}

        {/* Pool address */}
        <div className="pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Pool Address</span>
            <code className="text-xs text-zinc-400 font-mono bg-zinc-800 px-2 py-1 rounded">
              {pool.address}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClassName?: string;
}

function MetricItem({ icon: Icon, label, value, valueClassName }: MetricItemProps) {
  return (
    <div className="p-3 bg-zinc-800/30 rounded-lg">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className={cn('font-medium', valueClassName || 'text-zinc-200')}>
        {value}
      </p>
    </div>
  );
}

export default PoolMetrics;
