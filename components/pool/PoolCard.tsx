/**
 * PoolCard Component
 * 
 * Pool summary card displaying key metrics with selection state.
 */

'use client';

import React from 'react';
import { TrendingUp, Droplets, DollarSign, Percent, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Pool } from '@/types';

export interface PoolCardProps {
  pool: Pool;
  metrics: {
    tvlUSD: number;
    volumeUSD24h: number;
    feesUSD24h: number;
    apr: number;
  };
  isSelected?: boolean;
  onClick?: () => void;
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
 * PoolCard - Pool summary card
 * 
 * @example
 * ```tsx
 * <PoolCard 
 *   pool={pool}
 *   metrics={{ tvlUSD: 50000000, volumeUSD24h: 5000000, feesUSD24h: 15000, apr: 10.95 }}
 *   isSelected={true}
 *   onClick={() => selectPool(pool)}
 * />
 * ```
 */
export function PoolCard({
  pool,
  metrics,
  isSelected = false,
  onClick,
  className,
}: PoolCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:shadow-lg hover:shadow-emerald-500/5',
        isSelected
          ? 'bg-emerald-500/10 border-emerald-500/50'
          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700',
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Token pair icons */}
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
            
            {/* Pool name */}
            <div>
              <h3 className={cn(
                'font-semibold',
                isSelected ? 'text-emerald-400' : 'text-zinc-200'
              )}>
                {pool.token0.symbol}/{pool.token1.symbol}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-zinc-800 text-zinc-400"
                >
                  {feeTierLabels[pool.feeTier] || `${pool.feeTier / 10000}%`}
                </Badge>
                {isSelected && (
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-emerald-500/20 text-emerald-400"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Selected
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* APR badge */}
          <div className={cn(
            'px-3 py-1.5 rounded-lg text-right',
            metrics.apr > 20 ? 'bg-emerald-500/20' :
            metrics.apr > 10 ? 'bg-emerald-500/10' :
            'bg-zinc-800'
          )}>
            <p className="text-xs text-zinc-500">APR</p>
            <p className={cn(
              'font-bold',
              metrics.apr > 20 ? 'text-emerald-400' :
              metrics.apr > 10 ? 'text-emerald-400/80' :
              'text-zinc-300'
            )}>
              {metrics.apr.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* TVL */}
          <div className="p-3 bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500">TVL</span>
            </div>
            <p className="font-medium text-zinc-200">
              {formatUSD(metrics.tvlUSD)}
            </p>
          </div>

          {/* Volume */}
          <div className="p-3 bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500">24h Vol</span>
            </div>
            <p className="font-medium text-zinc-200">
              {formatUSD(metrics.volumeUSD24h)}
            </p>
          </div>

          {/* Fees */}
          <div className="p-3 bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500">24h Fees</span>
            </div>
            <p className="font-medium text-zinc-200">
              {formatUSD(metrics.feesUSD24h)}
            </p>
          </div>
        </div>

        {/* Pool address */}
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 font-mono">
            {pool.address.slice(0, 8)}...{pool.address.slice(-6)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default PoolCard;
