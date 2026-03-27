/**
 * RebalanceSettings Component
 * 
 * Rebalance configuration with mode selection and parameter inputs.
 */

'use client';

import React from 'react';
import { Clock, Percent, Activity, Ban, Settings2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export type RebalanceMode = 'none' | 'periodic' | 'threshold' | 'volatility';

export interface RebalanceParams {
  periodDays?: number;
  priceThreshold?: number;
  volatilityThreshold?: number;
}

export interface RebalanceSettingsProps {
  mode: RebalanceMode;
  params: RebalanceParams;
  onModeChange: (mode: RebalanceMode) => void;
  onParamsChange: (params: RebalanceParams) => void;
  className?: string;
}

interface ModeOption {
  value: RebalanceMode;
  label: string;
  description: string;
  icon: React.ElementType;
}

const modeOptions: ModeOption[] = [
  {
    value: 'none',
    label: 'No Rebalance',
    description: 'Position remains fixed until manually adjusted',
    icon: Ban,
  },
  {
    value: 'periodic',
    label: 'Periodic',
    description: 'Rebalance at fixed time intervals',
    icon: Clock,
  },
  {
    value: 'threshold',
    label: 'Price Threshold',
    description: 'Rebalance when price moves beyond threshold',
    icon: Percent,
  },
  {
    value: 'volatility',
    label: 'Volatility',
    description: 'Rebalance based on volatility conditions',
    icon: Activity,
  },
];

/**
 * RebalanceSettings - Rebalance configuration component
 * 
 * @example
 * ```tsx
 * <RebalanceSettings 
 *   mode="threshold"
 *   params={{ priceThreshold: 10 }}
 *   onModeChange={(mode) => setMode(mode)}
 *   onParamsChange={(params) => setParams(params)}
 * />
 * ```
 */
export function RebalanceSettings({
  mode,
  params,
  onModeChange,
  onParamsChange,
  className,
}: RebalanceSettingsProps) {
  const handleParamChange = (key: keyof RebalanceParams, value: number) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-zinc-400" />
          <h3 className="text-lg font-semibold text-zinc-100">
            Rebalance Settings
          </h3>
        </div>

        {/* Mode selection */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = mode === option.value;

            return (
              <button
                key={option.value}
                onClick={() => onModeChange(option.value)}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all duration-200',
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/50'
                    : 'bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isSelected ? 'bg-emerald-500/20' : 'bg-zinc-800'
                  )}>
                    <Icon className={cn(
                      'w-4 h-4',
                      isSelected ? 'text-emerald-400' : 'text-zinc-500'
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      'font-medium text-sm',
                      isSelected ? 'text-emerald-400' : 'text-zinc-300'
                    )}>
                      {option.label}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Mode-specific parameters */}
        {mode !== 'none' && (
          <div className="space-y-4 p-4 bg-zinc-800/30 rounded-xl border border-zinc-800">
            <p className="text-sm font-medium text-zinc-400 mb-3">
              Parameters
            </p>

            {/* Periodic rebalancing */}
            {mode === 'periodic' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400">
                    Rebalance Period
                  </label>
                  <span className="text-sm font-medium text-zinc-200">
                    {params.periodDays || 7} days
                  </span>
                </div>
                <Slider
                  value={[params.periodDays || 7]}
                  onValueChange={([value]) => handleParamChange('periodDays', value)}
                  min={1}
                  max={30}
                  step={1}
                />
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>1 day</span>
                  <span>30 days</span>
                </div>
              </div>
            )}

            {/* Price threshold rebalancing */}
            {mode === 'threshold' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400">
                    Price Change Threshold
                  </label>
                  <span className="text-sm font-medium text-zinc-200">
                    {params.priceThreshold || 10}%
                  </span>
                </div>
                <Slider
                  value={[params.priceThreshold || 10]}
                  onValueChange={([value]) => handleParamChange('priceThreshold', value)}
                  min={1}
                  max={50}
                  step={1}
                />
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>1%</span>
                  <span>50%</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Position will rebalance when price moves more than this threshold from entry.
                </p>
              </div>
            )}

            {/* Volatility rebalancing */}
            {mode === 'volatility' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400">
                    Volatility Threshold
                  </label>
                  <span className="text-sm font-medium text-zinc-200">
                    {params.volatilityThreshold || 50}%
                  </span>
                </div>
                <Slider
                  value={[params.volatilityThreshold || 50]}
                  onValueChange={([value]) => handleParamChange('volatilityThreshold', value)}
                  min={10}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>10%</span>
                  <span>100%</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Position will rebalance when annualized volatility exceeds this threshold.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <div className={cn(
              'w-2 h-2 rounded-full',
              mode === 'none' ? 'bg-zinc-500' : 'bg-emerald-500'
            )} />
            <span className="text-zinc-400">
              {mode === 'none' && 'Position will not auto-rebalance'}
              {mode === 'periodic' && `Rebalancing every ${params.periodDays || 7} days`}
              {mode === 'threshold' && `Rebalancing at ±${params.priceThreshold || 10}% price change`}
              {mode === 'volatility' && `Rebalancing when volatility > ${params.volatilityThreshold || 50}%`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default RebalanceSettings;
