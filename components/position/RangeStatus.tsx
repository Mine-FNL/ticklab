/**
 * RangeStatus Component
 * 
 * Position range status indicator with visual feedback.
 */

'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type RangeStatusType = 'in-range' | 'below-range' | 'above-range';

export interface RangeStatusProps {
  status: RangeStatusType;
  distanceToLower?: number; // percentage
  distanceToUpper?: number; // percentage
  currentPrice?: number;
  lowerPrice?: number;
  upperPrice?: number;
  className?: string;
}

/**
 * RangeStatus - Position range status indicator
 * 
 * @example
 * ```tsx
 * <RangeStatus 
 *   status="in-range"
 *   distanceToLower={15}
 *   distanceToUpper={20}
 *   currentPrice={1800}
 *   lowerPrice={1500}
 *   upperPrice={2000}
 * />
 * ```
 */
export function RangeStatus({
  status,
  distanceToLower,
  distanceToUpper,
  currentPrice,
  lowerPrice,
  upperPrice,
  className,
}: RangeStatusProps) {
  // Status configurations
  const statusConfig = {
    'in-range': {
      label: 'In Range',
      description: 'Position is actively earning fees',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/50',
      icon: CheckCircle2,
      progressColor: 'bg-emerald-500',
    },
    'below-range': {
      label: 'Below Range',
      description: 'Price is below your lower bound',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/20',
      borderColor: 'border-rose-500/50',
      icon: ArrowDown,
      progressColor: 'bg-rose-500',
    },
    'above-range': {
      label: 'Above Range',
      description: 'Price is above your upper bound',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/50',
      icon: ArrowUp,
      progressColor: 'bg-amber-500',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Calculate position within range (for visualization)
  const positionInRange = status === 'in-range' && distanceToLower && distanceToUpper
    ? (distanceToLower / (distanceToLower + distanceToUpper)) * 100
    : status === 'below-range' ? 0 : 100;

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-zinc-100">
          Range Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status indicator */}
        <div className={cn(
          'flex items-center gap-4 p-4 rounded-xl border',
          config.bgColor,
          config.borderColor
        )}>
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            status === 'in-range' ? 'bg-emerald-500/30' :
            status === 'below-range' ? 'bg-rose-500/30' :
            'bg-amber-500/30'
          )}>
            <StatusIcon className={cn('w-6 h-6', config.color)} />
          </div>
          <div>
            <p className={cn('text-lg font-bold', config.color)}>
              {config.label}
            </p>
            <p className="text-sm text-zinc-400">
              {config.description}
            </p>
          </div>
        </div>

        {/* Range visualization */}
        {(lowerPrice && upperPrice && currentPrice) && (
          <div className="py-4">
            {/* Range bar */}
            <div className="relative h-6 bg-zinc-800 rounded-full overflow-hidden">
              {/* Active range zone */}
              <div 
                className="absolute h-full bg-gradient-to-r from-emerald-600/50 to-emerald-400/50 rounded-full"
                style={{
                  left: '15%',
                  right: '15%',
                }}
              />
              
              {/* Current price marker */}
              <div 
                className={cn(
                  'absolute top-0 bottom-0 w-1 rounded-full transition-all duration-500',
                  status === 'in-range' ? 'bg-emerald-400' :
                  status === 'below-range' ? 'bg-rose-400' :
                  'bg-amber-400'
                )}
                style={{
                  left: `${Math.min(Math.max(positionInRange, 5), 95)}%`,
                }}
              >
                <div className={cn(
                  'absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full',
                  status === 'in-range' ? 'bg-emerald-400' :
                  status === 'below-range' ? 'bg-rose-400' :
                  'bg-amber-400'
                )} />
              </div>
            </div>

            {/* Price labels */}
            <div className="flex justify-between mt-2 text-sm">
              <div className="text-center">
                <p className="text-xs text-zinc-500">Lower</p>
                <p className="font-medium text-zinc-300 font-mono">
                  {lowerPrice.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500">Current</p>
                <p className={cn(
                  'font-bold font-mono',
                  status === 'in-range' ? 'text-emerald-400' :
                  status === 'below-range' ? 'text-rose-400' :
                  'text-amber-400'
                )}>
                  {currentPrice.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500">Upper</p>
                <p className="font-medium text-zinc-300 font-mono">
                  {upperPrice.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Distance indicators */}
        {(distanceToLower !== undefined || distanceToUpper !== undefined) && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
            {distanceToLower !== undefined && (
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Distance to Lower</p>
                <p className={cn(
                  'font-medium',
                  distanceToLower < 5 ? 'text-rose-400' : 'text-zinc-300'
                )}>
                  {distanceToLower.toFixed(1)}%
                </p>
              </div>
            )}
            {distanceToUpper !== undefined && (
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Distance to Upper</p>
                <p className={cn(
                  'font-medium',
                  distanceToUpper < 5 ? 'text-amber-400' : 'text-zinc-300'
                )}>
                  {distanceToUpper.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action suggestion */}
        {status !== 'in-range' && (
          <div className={cn(
            'p-3 rounded-lg border',
            status === 'below-range' 
              ? 'bg-rose-500/10 border-rose-500/30' 
              : 'bg-amber-500/10 border-amber-500/30'
          )}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={cn(
                'w-4 h-4 mt-0.5',
                status === 'below-range' ? 'text-rose-400' : 'text-amber-400'
              )} />
              <div>
                <p className={cn(
                  'text-sm font-medium',
                  status === 'below-range' ? 'text-rose-400' : 'text-amber-400'
                )}>
                  Rebalance Recommended
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {status === 'below-range'
                    ? 'Price has fallen below your range. Consider rebalancing to capture fees.'
                    : 'Price has risen above your range. Consider rebalancing to capture fees.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RangeStatus;
