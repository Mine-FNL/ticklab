/**
 * PositionValue Component
 * 
 * Position value breakdown showing token amounts and USD values.
 */

'use client';

import React from 'react';
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface PositionValueProps {
  token0Amount: number;
  token1Amount: number;
  token0ValueUSD: number;
  token1ValueUSD: number;
  totalValueUSD: number;
  token0Symbol: string;
  token1Symbol: string;
  initialValueUSD?: number;
  className?: string;
}

/**
 * PositionValue - Position value breakdown display
 * 
 * @example
 * ```tsx
 * <PositionValue 
 *   token0Amount={1.5}
 *   token1Amount={2500}
 *   token0ValueUSD={2700}
 *   token1ValueUSD={2500}
 *   totalValueUSD={5200}
 *   token0Symbol="ETH"
 *   token1Symbol="USDC"
 *   initialValueUSD={5000}
 * />
 * ```
 */
export function PositionValue({
  token0Amount,
  token1Amount,
  token0ValueUSD,
  token1ValueUSD,
  totalValueUSD,
  token0Symbol,
  token1Symbol,
  initialValueUSD,
  className,
}: PositionValueProps) {
  // Calculate P&L if initial value provided
  const pnl = initialValueUSD ? totalValueUSD - initialValueUSD : null;
  const pnlPercent = initialValueUSD ? (pnl! / initialValueUSD) * 100 : null;

  // Calculate token proportions
  const token0Proportion = (token0ValueUSD / totalValueUSD) * 100;
  const token1Proportion = (token1ValueUSD / totalValueUSD) * 100;

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-zinc-400" />
            <CardTitle className="text-lg font-semibold text-zinc-100">
              Position Value
            </CardTitle>
          </div>
          {pnl !== null && (
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
              pnl >= 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'
            )}>
              {pnl >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
              <span className={cn(
                'font-medium',
                pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              )}>
                {pnl >= 0 ? '+' : ''}{pnlPercent?.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total value */}
        <div className="text-center p-6 bg-zinc-800/50 rounded-xl">
          <p className="text-sm text-zinc-500 mb-1">Total Position Value</p>
          <p className="text-4xl font-bold text-zinc-100">
            ${totalValueUSD.toLocaleString(undefined, { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2 
            })}
          </p>
          {initialValueUSD && (
            <p className="text-sm text-zinc-500 mt-1">
              Initial: ${initialValueUSD.toLocaleString()}
            </p>
          )}
        </div>

        <Separator className="bg-zinc-800" />

        {/* Token breakdown */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Token Breakdown
          </p>
          
          {/* Token 0 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
                  {token0Symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium text-zinc-200">{token0Symbol}</p>
                  <p className="text-xs text-zinc-500">{token0Proportion.toFixed(1)}% of position</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-zinc-200">
                  {token0Amount.toFixed(6)} {token0Symbol}
                </p>
                <p className="text-sm text-zinc-400">
                  ${token0ValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${token0Proportion}%` }}
              />
            </div>
          </div>

          {/* Token 1 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
                  {token1Symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium text-zinc-200">{token1Symbol}</p>
                  <p className="text-xs text-zinc-500">{token1Proportion.toFixed(1)}% of position</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-zinc-200">
                  {token1Amount.toFixed(4)} {token1Symbol}
                </p>
                <p className="text-sm text-zinc-400">
                  ${token1ValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${token1Proportion}%` }}
              />
            </div>
          </div>
        </div>

        {/* Value summary */}
        <div className="pt-4 border-t border-zinc-800">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-1">Token 0 Value</p>
              <p className="font-medium text-emerald-400">
                ${token0ValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-1">Token 1 Value</p>
              <p className="font-medium text-indigo-400">
                ${token1ValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-1">Total</p>
              <p className="font-medium text-zinc-200">
                ${totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PositionValue;
