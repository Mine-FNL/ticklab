'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RangeStatusChartProps {
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
  token0Symbol: string;
  token1Symbol: string;
}

export function RangeStatusChart({
  currentPrice,
  lowerPrice,
  upperPrice,
  token0Symbol,
  token1Symbol,
}: RangeStatusChartProps) {
  // Calculate position
  const isInRange = currentPrice >= lowerPrice && currentPrice <= upperPrice;
  const isBelowRange = currentPrice < lowerPrice;
  const isAboveRange = currentPrice > upperPrice;

  // Calculate percentages for visualization
  const logLower = Math.log(lowerPrice);
  const logUpper = Math.log(upperPrice);
  const logCurrent = Math.log(currentPrice);
  const logRange = logUpper - logLower;

  // Position percentage (0 = at lower, 100 = at upper)
  let positionPercent: number;
  if (isBelowRange) {
    positionPercent = -20; // Show outside left
  } else if (isAboveRange) {
    positionPercent = 120; // Show outside right
  } else {
    positionPercent = ((logCurrent - logLower) / logRange) * 100;
  }

  // Calculate distances
  const distanceToLower = ((currentPrice - lowerPrice) / lowerPrice) * 100;
  const distanceToUpper = ((upperPrice - currentPrice) / currentPrice) * 100;

  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (price >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
  };

  const getStatusColor = () => {
    if (isInRange) return 'bg-emerald-500';
    if (isBelowRange) return 'bg-rose-500';
    return 'bg-amber-500';
  };

  const getStatusText = () => {
    if (isInRange) return 'In Range';
    if (isBelowRange) return 'Below Range';
    return 'Above Range';
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-zinc-100">
          Position Range Status
        </CardTitle>
        <p className="text-sm text-zinc-500">
          Current price relative to your position range
        </p>
      </CardHeader>
      <CardContent>
        {/* Status Badge */}
        <div className="flex justify-center mb-6">
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor()} text-white`}
          >
            {getStatusText()}
          </div>
        </div>

        {/* Range Visual */}
        <div className="relative mb-8">
          {/* Range Bar */}
          <div className="h-4 bg-zinc-800 rounded-full relative overflow-hidden">
            {/* Active range */}
            <div
              className="absolute h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              style={{
                left: '20%',
                width: '60%',
              }}
            />
            
            {/* Current price indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-zinc-900 shadow-lg transition-all"
              style={{
                left: `${Math.max(0, Math.min(100, positionPercent * 0.6 + 20))}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>{formatPrice(lowerPrice)}</span>
            <span className="text-emerald-400">{formatPrice(currentPrice)}</span>
            <span>{formatPrice(upperPrice)}</span>
          </div>
        </div>

        {/* Distance Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Distance to Lower</p>
            <p className={`text-sm font-medium ${distanceToLower < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {distanceToLower >= 0 ? '+' : ''}{distanceToLower.toFixed(2)}%
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Distance to Upper</p>
            <p className={`text-sm font-medium ${distanceToUpper < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {distanceToUpper >= 0 ? '+' : ''}{distanceToUpper.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Token Composition */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">Current Composition</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{
                  width: isBelowRange ? '100%' : isAboveRange ? '0%' : `${100 - positionPercent}%`,
                }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1 text-xs text-zinc-400">
            <span>{token0Symbol}</span>
            <span>{token1Symbol}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
