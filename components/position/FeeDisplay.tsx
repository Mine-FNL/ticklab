/**
 * FeeDisplay Component
 * 
 * Fee earnings display showing accumulated fees in both tokens and USD.
 */

'use client';

import React from 'react';
import { Coins, TrendingUp, Clock, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface FeeDisplayProps {
  fees0: number;
  fees1: number;
  feesUSD: number;
  token0Symbol: string;
  token1Symbol: string;
  timeInPosition?: number; // in seconds
  className?: string;
}

/**
 * FeeDisplay - Fee earnings display
 * 
 * @example
 * ```tsx
 * <FeeDisplay 
 *   fees0={0.05}
 *   fees1={100}
 *   feesUSD={190}
 *   token0Symbol="ETH"
 *   token1Symbol="USDC"
 *   timeInPosition={86400 * 7} // 7 days
 * />
 * ```
 */
export function FeeDisplay({
  fees0,
  fees1,
  feesUSD,
  token0Symbol,
  token1Symbol,
  timeInPosition,
  className,
}: FeeDisplayProps) {
  // Calculate daily fee rate
  const dailyFees = timeInPosition && timeInPosition > 0
    ? (feesUSD / (timeInPosition / 86400))
    : null;

  // Calculate APR (assuming we know position value - using feesUSD * 10 as estimate)
  const estimatedPositionValue = feesUSD * 20; // Rough estimate
  const feeAPR = dailyFees 
    ? ((dailyFees * 365) / estimatedPositionValue) * 100 
    : null;

  // Format duration
  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  };

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-lg font-semibold text-zinc-100">
              Fee Earnings
            </CardTitle>
          </div>
          {timeInPosition && (
            <div className="flex items-center gap-1.5 text-sm text-zinc-500">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(timeInPosition)}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total fees */}
        <div className="text-center p-6 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <p className="text-sm text-emerald-500/70 mb-1">Total Fees Earned</p>
          <p className="text-4xl font-bold text-emerald-400">
            ${feesUSD.toLocaleString(undefined, { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2 
            })}
          </p>
          {dailyFees && (
            <p className="text-sm text-emerald-500/60 mt-1">
              ~${dailyFees.toFixed(2)}/day
            </p>
          )}
        </div>

        <Separator className="bg-zinc-800" />

        {/* Token breakdown */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Fees by Token
          </p>
          
          <div className="space-y-3">
            {/* Token 0 fees */}
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-emerald-400">
                    {token0Symbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-zinc-200">{token0Symbol}</p>
                  <p className="text-xs text-zinc-500">Fee Token 0</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-zinc-200">
                  {fees0.toFixed(8)} {token0Symbol}
                </p>
              </div>
            </div>

            {/* Token 1 fees */}
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-400">
                    {token1Symbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-zinc-200">{token1Symbol}</p>
                  <p className="text-xs text-zinc-500">Fee Token 1</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-zinc-200">
                  {fees1.toFixed(4)} {token1Symbol}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fee metrics */}
        {feeAPR && (
          <div className="pt-4 border-t border-zinc-800">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-zinc-800/30 rounded-lg text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-zinc-500">Fee APR</span>
                </div>
                <p className="text-lg font-bold text-emerald-400">
                  {feeAPR.toFixed(2)}%
                </p>
              </div>
              <div className="p-3 bg-zinc-800/30 rounded-lg text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-500">Projected (1Y)</span>
                </div>
                <p className="text-lg font-bold text-zinc-300">
                  ${(feesUSD * (365 / (timeInPosition! / 86400))).toLocaleString(undefined, { 
                    maximumFractionDigits: 0 
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FeeDisplay;
