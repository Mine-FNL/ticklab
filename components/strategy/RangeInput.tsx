/**
 * RangeInput Component
 * 
 * Price range input with visual feedback and preset buttons.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Minus, Plus, Target, ArrowLeftRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export interface RangeInputProps {
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
  onLowerChange: (price: number) => void;
  onUpperChange: (price: number) => void;
  token0Symbol: string;
  token1Symbol: string;
  className?: string;
}

// Range presets as percentage from current price
const rangePresets = [
  { label: 'Narrow', lower: -5, upper: 5 },
  { label: 'Medium', lower: -10, upper: 10 },
  { label: 'Wide', lower: -25, upper: 25 },
  { label: 'Full', lower: -50, upper: 50 },
];

/**
 * RangeInput - Price range input with visual feedback
 * 
 * @example
 * ```tsx
 * <RangeInput 
 *   currentPrice={1800}
 *   lowerPrice={1620}
 *   upperPrice={1980}
 *   onLowerChange={(price) => setLowerPrice(price)}
 *   onUpperChange={(price) => setUpperPrice(price)}
 *   token0Symbol="ETH"
 *   token1Symbol="USDC"
 * />
 * ```
 */
export function RangeInput({
  currentPrice,
  lowerPrice,
  upperPrice,
  onLowerChange,
  onUpperChange,
  token0Symbol,
  token1Symbol,
  className,
}: RangeInputProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Calculate percentages
  const lowerPercent = ((lowerPrice / currentPrice - 1) * 100);
  const upperPercent = ((upperPrice / currentPrice - 1) * 100);
  const rangeWidth = upperPercent - lowerPercent;

  // Apply preset
  const applyPreset = useCallback((preset: typeof rangePresets[0]) => {
    const newLower = currentPrice * (1 + preset.lower / 100);
    const newUpper = currentPrice * (1 + preset.upper / 100);
    onLowerChange(newLower);
    onUpperChange(newUpper);
    setActivePreset(preset.label);
  }, [currentPrice, onLowerChange, onUpperChange]);

  // Handle slider change
  const handleSliderChange = (values: number[]) => {
    const [lower, upper] = values;
    onLowerChange(currentPrice * (1 + lower / 100));
    onUpperChange(currentPrice * (1 + upper / 100));
    setActivePreset(null);
  };

  // Adjust range
  const adjustRange = (adjustment: number, isLower: boolean) => {
    if (isLower) {
      onLowerChange(lowerPrice * (1 + adjustment));
    } else {
      onUpperChange(upperPrice * (1 + adjustment));
    }
    setActivePreset(null);
  };

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">
              Price Range
            </h3>
            <p className="text-sm text-zinc-500">
              Set your position range around current price
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Current Price</p>
            <p className="text-xl font-bold text-emerald-400">
              {currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </p>
            <p className="text-xs text-zinc-500">
              {token1Symbol} per {token0Symbol}
            </p>
          </div>
        </div>

        {/* Range presets */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {rangePresets.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              onClick={() => applyPreset(preset)}
              className={cn(
                'h-auto py-2 border-zinc-800 transition-all',
                activePreset === preset.label
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              )}
            >
              <div className="text-center">
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="text-xs opacity-70">
                  {preset.lower}% / +{preset.upper}%
                </p>
              </div>
            </Button>
          ))}
        </div>

        {/* Visual range indicator */}
        <div className="mb-6">
          <div className="relative h-12 bg-zinc-800 rounded-xl overflow-hidden">
            {/* Range zone */}
            <div 
              className="absolute h-full bg-gradient-to-r from-emerald-600/50 to-emerald-400/50"
              style={{
                left: `${Math.max(0, (lowerPercent + 50))}%`,
                right: `${Math.max(0, 50 - upperPercent)}%`,
              }}
            />
            
            {/* Current price marker */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white"
              style={{ left: '50%' }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
            </div>
            
            {/* Labels */}
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <span className="text-xs text-zinc-500">-50%</span>
              <span className="text-xs font-medium text-zinc-300">Current</span>
              <span className="text-xs text-zinc-500">+50%</span>
            </div>
          </div>
        </div>

        {/* Range slider */}
        <div className="mb-6">
          <Slider
            value={[lowerPercent, upperPercent]}
            onValueChange={handleSliderChange}
            min={-50}
            max={50}
            step={1}
            className="w-full"
          />
        </div>

        {/* Price inputs */}
        <div className="grid grid-cols-2 gap-4">
          {/* Lower price */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-400">
                Min Price
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => adjustRange(-0.01, true)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => adjustRange(0.01, true)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={lowerPrice.toFixed(6)}
                onChange={(e) => onLowerChange(parseFloat(e.target.value))}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                {lowerPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Upper price */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-400">
                Max Price
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => adjustRange(-0.01, false)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => adjustRange(0.01, false)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={upperPrice.toFixed(6)}
                onChange={(e) => onUpperChange(parseFloat(e.target.value))}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                +{upperPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Range summary */}
        <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-zinc-400">
              <ArrowLeftRight className="w-4 h-4" />
              <span>Range Width</span>
            </div>
            <span className="font-medium text-zinc-200">{rangeWidth.toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default RangeInput;
