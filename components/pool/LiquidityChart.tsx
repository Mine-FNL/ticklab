/**
 * LiquidityChart Component
 * 
 * Liquidity distribution chart showing liquidity depth across price ticks.
 */

'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Pool } from '@/types';

export interface LiquidityChartProps {
  pool: Pool;
  currentTick: number;
  className?: string;
}

interface LiquidityDataPoint {
  tick: number;
  price: number;
  liquidity: number;
  label: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: LiquidityDataPoint;
  }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl">
        <p className="text-zinc-200 font-medium mb-1">
          Tick: {data.tick}
        </p>
        <p className="text-sm text-zinc-400">
          Price: <span className="text-zinc-200">{data.price.toFixed(6)}</span>
        </p>
        <p className="text-sm text-zinc-400">
          Liquidity: <span className="text-zinc-200">{data.liquidity.toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

/**
 * Generate mock liquidity distribution data
 */
function generateLiquidityData(pool: Pool, currentTick: number): LiquidityDataPoint[] {
  const data: LiquidityDataPoint[] = [];
  const tickSpacing = pool.tickSpacing;
  const range = 50; // Number of ticks to show on each side
  
  // Generate liquidity distribution (simulated Gaussian-like distribution)
  for (let i = -range; i <= range; i++) {
    const tick = currentTick + i * tickSpacing;
    
    // Simulate price from tick (simplified)
    const price = 1.0001 ** tick;
    
    // Generate liquidity with peaks around current price
    const distanceFromCurrent = Math.abs(i);
    const baseLiquidity = parseFloat(pool.liquidity) / 100;
    const liquidity = baseLiquidity * Math.exp(-distanceFromCurrent / 20) * 
                      (1 + Math.random() * 0.2);
    
    data.push({
      tick,
      price,
      liquidity: Math.max(0, liquidity),
      label: `${tick}`,
    });
  }
  
  return data;
}

/**
 * LiquidityChart - Liquidity distribution visualization
 * 
 * @example
 * ```tsx
 * <LiquidityChart 
 *   pool={pool}
 *   currentTick={-200000}
 * />
 * ```
 */
export function LiquidityChart({
  pool,
  currentTick,
  className,
}: LiquidityChartProps) {
  // Generate liquidity data
  const data = useMemo(() => 
    generateLiquidityData(pool, currentTick),
    [pool, currentTick]
  );

  // Calculate statistics
  const totalLiquidity = data.reduce((sum, d) => sum + d.liquidity, 0);
  const maxLiquidity = Math.max(...data.map(d => d.liquidity));
  const avgLiquidity = totalLiquidity / data.length;

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-zinc-100">
              Liquidity Distribution
            </CardTitle>
            <p className="text-sm text-zinc-500">
              Liquidity depth across price ticks
            </p>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-xs text-zinc-500">Total Liquidity</p>
              <p className="text-sm font-medium text-zinc-300">
                {(totalLiquidity / 1e6).toFixed(2)}M
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Peak</p>
              <p className="text-sm font-medium text-emerald-400">
                {(maxLiquidity / 1e6).toFixed(2)}M
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="liquidityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#27272a" 
                vertical={false}
              />
              
              <XAxis 
                dataKey="tick"
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={{ stroke: '#3f3f46' }}
                tickFormatter={(value) => value.toString()}
                minTickGap={30}
              />
              
              <YAxis 
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickFormatter={(value) => `${(value / 1e6).toFixed(1)}M`}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={{ stroke: '#3f3f46' }}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              {/* Current tick reference line */}
              <ReferenceLine 
                x={currentTick} 
                stroke="#fbbf24" 
                strokeDasharray="5 5"
                label={{ 
                  value: 'Current', 
                  fill: '#fbbf24', 
                  fontSize: 10,
                  position: 'top'
                }}
              />
              
              <Area
                type="monotone"
                dataKey="liquidity"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#liquidityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Liquidity stats */}
        <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-zinc-800">
          <div className="text-center">
            <p className="text-xs text-zinc-500 mb-1">Current Tick</p>
            <p className="text-sm font-medium text-zinc-300 font-mono">
              {currentTick}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 mb-1">Tick Spacing</p>
            <p className="text-sm font-medium text-zinc-300">
              {pool.tickSpacing}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 mb-1">Avg Liquidity</p>
            <p className="text-sm font-medium text-zinc-300">
              {(avgLiquidity / 1e6).toFixed(2)}M
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 mb-1">Concentration</p>
            <p className="text-sm font-medium text-emerald-400">
              {(maxLiquidity / avgLiquidity).toFixed(1)}x
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default LiquidityChart;
