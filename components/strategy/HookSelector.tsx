/**
 * HookSelector - Uniswap V4 Hook Selection & Analysis
 * 
 * Allows users to browse, select, and analyze V4 hooks.
 * Shows hook-specific LP impact estimates and recommendations.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Zap, Shield, Lock, Wind, Coins, AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  HOOK_REGISTRY,
  getHooksForChain,
  getAllHookCategories,
  calculateHookLPScore,
  recommendHooks,
  type HookCategory,
  type RegisteredHook,
} from '@/lib/univ4/hooks';

const CATEGORY_ICONS: Record<HookCategory, React.ReactNode> = {
  fee: <Coins className="w-4 h-4" />,
  liquidity: <Lock className="w-4 h-4" />,
  flow: <Wind className="w-4 h-4" />,
  yield: <Zap className="w-4 h-4" />,
  risk: <Shield className="w-4 h-4" />,
  access: <Lock className="w-4 h-4" />,
  custom: <Zap className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<HookCategory, string> = {
  fee: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  liquidity: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  flow: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  yield: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  risk: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  access: 'bg-red-500/20 text-red-400 border-red-500/30',
  custom: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const AUDIT_COLORS = {
  audited: 'bg-emerald-500/20 text-emerald-400',
  partial: 'bg-amber-500/20 text-amber-400',
  unaudited: 'bg-red-500/20 text-red-400',
  experimental: 'bg-purple-500/20 text-purple-400',
};

export interface HookSelectorProps {
  chainId: number;
  baseAPR: number;
  volatility: number;
  onHookSelect: (hookId: string | null) => void;
  selectedHookId?: string | null;
  className?: string;
}

export function HookSelector({
  chainId,
  baseAPR,
  volatility,
  onHookSelect,
  selectedHookId,
  className,
}: HookSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<HookCategory | 'all'>('all');
  const [expandedHook, setExpandedHook] = useState<string | null>(null);
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>('medium');
  const [showRecommendations, setShowRecommendations] = useState(false);

  const hooks = useMemo(() => getHooksForChain(chainId), [chainId]);
  const categories = useMemo(() => getAllHookCategories(), []);

  const filteredHooks = useMemo(() => {
    if (activeCategory === 'all') return hooks;
    return hooks.filter((h) => h.category === activeCategory);
  }, [hooks, activeCategory]);

  const recommendations = useMemo(() => {
    if (!showRecommendations) return [];
    return recommendHooks({
      pairSymbol: '',
      volatility,
      baseAPR,
      chainId,
      riskTolerance,
      timeHorizonDays: 30,
    });
  }, [showRecommendations, volatility, baseAPR, chainId, riskTolerance]);

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Hook Analysis
          </h3>
          <p className="text-xs text-zinc-500">
            Select V4 hooks to model their impact on LP returns
          </p>
        </div>

        {/* Recommendations Toggle */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={showRecommendations ? 'default' : 'outline'}
            onClick={() => setShowRecommendations(!showRecommendations)}
            className={showRecommendations ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'border-zinc-700 text-zinc-400'}
          >
            {showRecommendations ? 'Hide' : 'Show'} Recommendations
          </Button>
          {showRecommendations && (
            <div className="flex gap-1">
              {(['low', 'medium', 'high'] as const).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={riskTolerance === r ? 'default' : 'outline'}
                  onClick={() => setRiskTolerance(r)}
                  className={cn(
                    'text-xs capitalize',
                    riskTolerance === r ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'border-zinc-700 text-zinc-400'
                  )}
                >
                  {r}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        {showRecommendations && recommendations.length > 0 && (
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-2">
            <p className="text-xs font-medium text-emerald-400">Top Recommendations ({riskTolerance} risk)</p>
            {recommendations.map((rec) => (
              <button
                key={rec.hookId}
                onClick={() => onHookSelect(rec.hookId)}
                className={cn(
                  'w-full text-left p-2 rounded-lg border transition-all text-xs',
                  selectedHookId === rec.hookId
                    ? 'bg-emerald-500/20 border-emerald-500/50'
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">{rec.hook.name}</span>
                  <span className="text-emerald-400">{((rec.score.netAPR / Math.max(baseAPR, 0.0001) - 1) * 100).toFixed(0)}% vs base</span>
                </div>
                <p className="text-zinc-500 mt-0.5 truncate">{rec.score.recommendation}</p>
              </button>
            ))}
          </div>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-all border',
              activeCategory === 'all'
                ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                : 'bg-zinc-800 text-zinc-500 border-zinc-800 hover:border-zinc-700'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all border capitalize flex items-center gap-1',
                activeCategory === cat
                  ? CATEGORY_COLORS[cat]
                  : 'bg-zinc-800 text-zinc-500 border-zinc-800 hover:border-zinc-700'
              )}
            >
              {CATEGORY_ICONS[cat]}
              {cat}
            </button>
          ))}
        </div>

        {/* Hook List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {filteredHooks.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-4">No hooks available for this chain</p>
          )}
          {filteredHooks.map((hook) => {
            const hookId = Object.entries(HOOK_REGISTRY).find(([, v]) => v === hook)?.[0] || '';
            const isSelected = selectedHookId === hookId;
            const isExpanded = expandedHook === hookId;
            const score = calculateHookLPScore({
              baseAPR,
              hookId,
              pairVolatility: volatility,
              estimatedDailySwaps: 50,
            });

            return (
              <div
                key={hookId}
                className={cn(
                  'border rounded-lg transition-all overflow-hidden',
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'
                )}
              >
                {/* Hook Header */}
                <button
                  onClick={() => setExpandedHook(isExpanded ? null : hookId)}
                  className="w-full p-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn('p-1.5 rounded-md', CATEGORY_COLORS[hook.category])}>
                      {CATEGORY_ICONS[hook.category]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{hook.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className={cn('text-[10px] px-1 py-0', AUDIT_COLORS[hook.behaviors.auditStatus])}>
                          {hook.behaviors.auditStatus}
                        </Badge>
                        <span className="text-[10px] text-zinc-500 capitalize">{hook.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Selected</Badge>}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3">
                    <p className="text-xs text-zinc-400 leading-relaxed">{hook.behaviors.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-zinc-900/50 rounded-lg">
                        <span className="text-zinc-500">Fee Adjustment</span>
                        <p className="text-zinc-300 capitalize">{hook.behaviors.feeAdjustment}</p>
                      </div>
                      <div className="p-2 bg-zinc-900/50 rounded-lg">
                        <span className="text-zinc-500">Flow Multiplier</span>
                        <p className="text-zinc-300">{hook.behaviors.flowMultiplier.toFixed(2)}x</p>
                      </div>
                      <div className="p-2 bg-zinc-900/50 rounded-lg">
                        <span className="text-zinc-500">Gas Overhead</span>
                        <p className="text-zinc-300">{hook.behaviors.gasOverheadPerSwap.toLocaleString()} gas/swap</p>
                      </div>
                      <div className="p-2 bg-zinc-900/50 rounded-lg">
                        <span className="text-zinc-500">Est. Net APR</span>
                        <p className={score.netAPR > baseAPR ? 'text-emerald-400' : 'text-zinc-300'}>
                          {(score.netAPR * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {hook.behaviors.requiresStaking && (
                      <div className="flex items-start gap-2 p-2 bg-purple-500/10 rounded-lg">
                        <Lock className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-purple-400">Requires staking for optimal returns</p>
                      </div>
                    )}

                    {hook.behaviors.lockupPeriodDays && (
                      <div className="flex items-start gap-2 p-2 bg-orange-500/10 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-orange-400">{hook.behaviors.lockupPeriodDays} day minimum lockup</p>
                      </div>
                    )}

                    <div className="p-2 bg-zinc-900/50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-zinc-400">{hook.behaviors.lpImpact}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onHookSelect(isSelected ? null : hookId)}
                        className={cn(
                          'flex-1 text-xs',
                          isSelected
                            ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                            : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                        )}
                      >
                        {isSelected ? 'Deselect' : 'Select Hook'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
