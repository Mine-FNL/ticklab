/**
 * PriceDisplay Component
 * 
 * Price display with formatting and 24h change indicator.
 */

'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface PriceDisplayProps {
  price: number;
  token0Symbol: string;
  token1Symbol: string;
  change24h?: number;
  change24hUSD?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * PriceDisplay - Price display with formatting
 * 
 * @example
 * ```tsx
 * <PriceDisplay 
 *   price={1800.50}
 *   token0Symbol="ETH"
 *   token1Symbol="USDC"
 *   change24h={2.5}
 *   size="lg"
 * />
 * ```
 */
export function PriceDisplay({
  price,
  token0Symbol,
  token1Symbol,
  change24h,
  change24hUSD,
  className,
  size = 'md',
}: PriceDisplayProps) {
  // Determine size classes
  const sizeClasses = {
    sm: {
      price: 'text-xl',
      symbol: 'text-xs',
      change: 'text-xs',
    },
    md: {
      price: 'text-3xl',
      symbol: 'text-sm',
      change: 'text-sm',
    },
    lg: {
      price: 'text-5xl',
      symbol: 'text-base',
      change: 'text-base',
    },
  };

  const classes = sizeClasses[size];

  // Format price based on magnitude
  const formatPrice = (value: number): string => {
    if (value >= 1000) {
      return value.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    } else if (value >= 1) {
      return value.toLocaleString(undefined, { 
        minimumFractionDigits: 4, 
        maximumFractionDigits: 6 
      });
    } else {
      return value.toLocaleString(undefined, { 
        minimumFractionDigits: 6, 
        maximumFractionDigits: 8 
      });
    }
  };

  // Get change indicator
  const getChangeIndicator = () => {
    if (change24h === undefined || change24h === 0) {
      return <Minus className="w-4 h-4 text-zinc-500" />;
    }
    if (change24h > 0) {
      return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    }
    return <TrendingDown className="w-4 h-4 text-rose-400" />;
  };

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardContent className="p-4">
        <div className="flex items-end justify-between">
          {/* Price */}
          <div>
            <p className={cn('font-bold text-zinc-100', classes.price)}>
              {formatPrice(price)}
            </p>
            <p className={cn('text-zinc-500 mt-1', classes.symbol)}>
              {token1Symbol} per {token0Symbol}
            </p>
          </div>

          {/* 24h change */}
          {change24h !== undefined && (
            <div className="text-right">
              <div className={cn(
                'flex items-center gap-1.5 justify-end',
                classes.change
              )}>
                {getChangeIndicator()}
                <span className={cn(
                  'font-medium',
                  change24h > 0 ? 'text-emerald-400' :
                  change24h < 0 ? 'text-rose-400' :
                  'text-zinc-500'
                )}>
                  {change24h > 0 ? '+' : ''}{change24h.toFixed(2)}%
                </span>
              </div>
              {change24hUSD !== undefined && (
                <p className={cn(
                  'text-zinc-500 mt-0.5',
                  size === 'sm' ? 'text-xs' : 'text-sm'
                )}>
                  {change24hUSD >= 0 ? '+' : ''}${Math.abs(change24hUSD).toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Price breakdown */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Inverse Price</p>
              <p className="font-medium text-zinc-300">
                {(1 / price).toLocaleString(undefined, { 
                  maximumFractionDigits: 8 
                })} {token0Symbol}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Price Format</p>
              <p className="font-medium text-zinc-300">
                {token0Symbol}/{token1Symbol}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PriceDisplay;
