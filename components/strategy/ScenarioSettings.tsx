/**
 * ScenarioSettings Component
 * 
 * Scenario parameter inputs for backtesting and simulations.
 */

'use client';

import React from 'react';
import { Calendar, Fuel, BarChart3, Settings2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export type VolumeScenario = 'low' | 'base' | 'high' | 'custom';

export interface ScenarioSettingsProps {
  horizonDays: number;
  gasCostGwei: number;
  volumeScenario: VolumeScenario;
  onHorizonChange: (days: number) => void;
  onGasCostChange: (gwei: number) => void;
  onVolumeScenarioChange: (scenario: VolumeScenario) => void;
  className?: string;
}

interface VolumeOption {
  value: VolumeScenario;
  label: string;
  description: string;
  multiplier: number;
}

const volumeOptions: VolumeOption[] = [
  {
    value: 'low',
    label: 'Low Volume',
    description: '50% of historical average',
    multiplier: 0.5,
  },
  {
    value: 'base',
    label: 'Base Case',
    description: 'Historical average volume',
    multiplier: 1.0,
  },
  {
    value: 'high',
    label: 'High Volume',
    description: '150% of historical average',
    multiplier: 1.5,
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Define your own volume multiplier',
    multiplier: 1.0,
  },
];

/**
 * ScenarioSettings - Scenario parameter inputs
 * 
 * @example
 * ```tsx
 * <ScenarioSettings 
 *   horizonDays={30}
 *   gasCostGwei={20}
 *   volumeScenario="base"
 *   onHorizonChange={(days) => setHorizon(days)}
 *   onGasCostChange={(gwei) => setGasCost(gwei)}
 *   onVolumeScenarioChange={(scenario) => setVolumeScenario(scenario)}
 * />
 * ```
 */
export function ScenarioSettings({
  horizonDays,
  gasCostGwei,
  volumeScenario,
  onHorizonChange,
  onGasCostChange,
  onVolumeScenarioChange,
  className,
}: ScenarioSettingsProps) {
  const selectedVolume = volumeOptions.find(v => v.value === volumeScenario);

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-zinc-400" />
          <h3 className="text-lg font-semibold text-zinc-100">
            Scenario Settings
          </h3>
        </div>

        {/* Time horizon */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <label className="text-sm font-medium text-zinc-400">
              Time Horizon
            </label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Duration</span>
              <span className="text-lg font-bold text-zinc-200">
                {horizonDays} days
              </span>
            </div>
            <Slider
              value={[horizonDays]}
              onValueChange={([value]) => onHorizonChange(value)}
              min={1}
              max={365}
              step={1}
            />
            <div className="flex justify-between text-xs text-zinc-600">
              <span>1 day</span>
              <span>30 days</span>
              <span>90 days</span>
              <span>1 year</span>
            </div>
            
            {/* Quick select buttons */}
            <div className="flex gap-2 mt-2">
              {[7, 30, 90, 180, 365].map((days) => (
                <button
                  key={days}
                  onClick={() => onHorizonChange(days)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    horizonDays === days
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                  )}
                >
                  {days === 365 ? '1Y' : `${days}D`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Gas cost */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Fuel className="w-4 h-4 text-zinc-500" />
            <label className="text-sm font-medium text-zinc-400">
              Gas Cost
            </label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Cost per transaction</span>
              <span className="text-lg font-bold text-zinc-200">
                {gasCostGwei} gwei
              </span>
            </div>
            <Slider
              value={[gasCostGwei]}
              onValueChange={([value]) => onGasCostChange(value)}
              min={1}
              max={200}
              step={1}
            />
            <div className="flex justify-between text-xs text-zinc-600">
              <span>1 gwei</span>
              <span>100 gwei</span>
              <span>200 gwei</span>
            </div>
            
            {/* Gas presets */}
            <div className="flex gap-2 mt-2">
              {[
                { label: 'Low', value: 10 },
                { label: 'Normal', value: 30 },
                { label: 'High', value: 80 },
                { label: 'Extreme', value: 150 },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => onGasCostChange(value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    gasCostGwei === value
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Volume scenario */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-zinc-500" />
            <label className="text-sm font-medium text-zinc-400">
              Volume Scenario
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {volumeOptions.map((option) => {
              const isSelected = volumeScenario === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => onVolumeScenarioChange(option.value)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all duration-200',
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <p className={cn(
                    'font-medium text-sm',
                    isSelected ? 'text-emerald-400' : 'text-zinc-300'
                  )}>
                    {option.label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {option.description}
                  </p>
                  {option.value !== 'custom' && (
                    <p className="text-xs text-zinc-600 mt-1">
                      {option.multiplier}x multiplier
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 p-4 bg-zinc-800/50 rounded-xl">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
            Scenario Summary
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Simulation period:</span>
              <span className="text-zinc-200">{horizonDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Gas cost:</span>
              <span className="text-zinc-200">{gasCostGwei} gwei</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Volume assumption:</span>
              <span className="text-zinc-200">{selectedVolume?.label}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ScenarioSettings;
