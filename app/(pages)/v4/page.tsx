'use client';

import React from 'react';
import { Zap, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { V4StrategyBuilder } from '@/components/strategy/V4StrategyBuilder';

export default function V4Page() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-400" />
          V4 Strategy Lab
        </h1>
        <p className="text-sm text-[#888] mt-1">
          Explore Uniswap V4 pools, hooks, and LP outcomes
        </p>
      </div>

      {/* Info Card */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="text-zinc-300">
                Uniswap V4 introduces <strong className="text-amber-400">hooks</strong> — smart contracts that 
                customize pool behavior. Hooks can adjust fees, capture MEV, add yield layers, or enforce 
                liquidity lockups.
              </p>
              <p className="text-zinc-400">
                This tool helps you model how different hooks affect your LP returns, estimate optimal ranges, 
                and compare hook configurations side-by-side.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs border border-blue-500/20">Fee Hooks</span>
                <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded text-xs border border-cyan-500/20">Flow Hooks</span>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs border border-emerald-500/20">Yield Hooks</span>
                <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded text-xs border border-orange-500/20">Risk Hooks</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Builder */}
      <V4StrategyBuilder />
    </div>
  );
}
