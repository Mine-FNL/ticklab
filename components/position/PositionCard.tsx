/**
 * PositionCard Component
 * 
 * Imported position card displaying position details, current value, and unclaimed fees.
 */

'use client';

import React from 'react';
import { Wallet, ExternalLink, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ImportedPosition, PositionValue, FeeEstimate } from '@/types';

export interface PositionCardProps {
  position: ImportedPosition;
  currentValue: PositionValue;
  unclaimedFees: FeeEstimate;
  currentPrice?: number;
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

type RangeStatus = 'in-range' | 'below-range' | 'above-range';

/**
 * Determine position range status
 */
function getRangeStatus(
  currentPrice: number,
  tickLower: number,
  tickUpper: number
): RangeStatus {
  const lowerPrice = 1.0001 ** tickLower;
  const upperPrice = 1.0001 ** tickUpper;
  
  if (currentPrice < lowerPrice) return 'below-range';
  if (currentPrice > upperPrice) return 'above-range';
  return 'in-range';
}

/**
 * PositionCard - Imported position display card
 * 
 * @example
 * ```tsx
 * <PositionCard 
 *   position={importedPosition}
 *   currentValue={{ token0Amount: 1.5, token1Amount: 2500, token0ValueUSD: 2700, token1ValueUSD: 2500, totalValueUSD: 5200 }}
 *   unclaimedFees={{ fees0: 0.01, fees1: 20, feesUSD: 38 }}
 *   currentPrice={1800}
 *   onClick={() => viewPosition(position)}
 * />
 * ```
 */
export function PositionCard({
  position,
  currentValue,
  unclaimedFees,
  currentPrice,
  onClick,
  className,
}: PositionCardProps) {
  const { pool, tickLower, tickUpper, tokenId } = position;
  
  // Calculate range status
  const rangeStatus = currentPrice 
    ? getRangeStatus(currentPrice, tickLower, tickUpper)
    : 'in-range';

  // Status configuration
  const statusConfig = {
    'in-range': {
      label: 'In Range',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/50',
      icon: CheckCircle2,
    },
    'below-range': {
      label: 'Below Range',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/20',
      borderColor: 'border-rose-500/50',
      icon: XCircle,
    },
    'above-range': {
      label: 'Above Range',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/50',
      icon: AlertCircle,
    },
  };

  const config = statusConfig[rangeStatus];
  const StatusIcon = config.icon;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:shadow-lg hover:shadow-emerald-500/5 hover:border-zinc-700',
        'bg-zinc-900/50 border-zinc-800',
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
            
            {/* Position info */}
            <div>
              <h3 className="font-semibold text-zinc-200">
                {pool.token0.symbol}/{pool.token1.symbol}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-zinc-800 text-zinc-400"
                >
                  {feeTierLabels[pool.feeTier] || `${pool.feeTier / 10000}%`}
                </Badge>
                <span className="text-xs text-zinc-500 font-mono">
                  #{tokenId}
                </span>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
            config.bgColor,
            config.color,
            'border',
            config.borderColor
          )}>
            <StatusIcon className="w-3.5 h-3.5" />
            {config.label}
          </div>
        </div>

        {/* Value section */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-zinc-800/50 rounded-lg">
            <p className="text-xs text-zinc-500 mb-1">Total Value</p>
            <p className="text-xl font-bold text-zinc-200">
              ${currentValue.totalValueUSD.toLocaleString(undefined, { 
                maximumFractionDigits: 2 
              })}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <p className="text-xs text-emerald-500/70 mb-1">Unclaimed Fees</p>
            <p className="text-xl font-bold text-emerald-400">
              ${unclaimedFees.feesUSD.toLocaleString(undefined, { 
                maximumFractionDigits: 2 
              })}
            </p>
          </div>
        </div>

        <Separator className="bg-zinc-800 mb-4" />

        {/* Token breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Token Holdings
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                  {pool.token0.symbol.slice(0, 2)}
                </div>
                <span className="text-sm text-zinc-400">{pool.token0.symbol}</span>
              </div>
              <span className="text-sm font-medium text-zinc-200">
                {currentValue.token0Amount.toFixed(6)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                  {pool.token1.symbol.slice(0, 2)}
                </div>
                <span className="text-sm text-zinc-400">{pool.token1.symbol}</span>
              </div>
              <span className="text-sm font-medium text-zinc-200">
                {currentValue.token1Amount.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* Range info */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-zinc-500">Min: </span>
                <span className="text-zinc-300 font-mono">
                  {(1.0001 ** tickLower).toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Max: </span>
                <span className="text-zinc-300 font-mono">
                  {(1.0001 ** tickUpper).toFixed(4)}
                </span>
              </div>
            </div>
            <button 
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 
                         transition-colors text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://etherscan.io/nft/${pool.address}/${tokenId}`, '_blank');
              }}
            >
              View on Explorer
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PositionCard;
