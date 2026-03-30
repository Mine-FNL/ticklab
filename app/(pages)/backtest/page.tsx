'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { CHAIN_NAMES } from '@/lib/constants';
import { BacktestRunner } from '@/components/backtest/BacktestRunner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Clock, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function BacktestPage() {
  const { selectedChain, selectedPool } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Small delay to allow store to initialize
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, [selectedChain]);

  // Get token address for the backtest
  // For ETH pairs, use WETH address based on chain
  const getTokenAddress = (): string => {
    if (!selectedPool) return '';
    
    // Try to use token1 (usually the quote token like USDC/WETH)
    // For backtesting, we typically want the non-stablecoin token
    const token1Symbol = selectedPool.token1.symbol.toUpperCase();
    
    // For ETH pairs, use WETH
    if (token1Symbol === 'WETH' || token1Symbol === 'ETH') {
      return selectedPool.token1.address;
    }
    // For other pairs, use token0
    return selectedPool.token0.address;
  };

  const tokenAddress = getTokenAddress();
  const chainId = selectedChain;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Historical Backtest</h1>
        <p className="text-sm text-[#888] mt-1">
          Simulate LP strategy performance using historical price data on {CHAIN_NAMES[selectedChain] || 'Ethereum'}
        </p>
      </div>

      {/* No pool selected state */}
      {!selectedPool ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="w-12 h-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Pool Selected</h3>
            <p className="text-sm text-zinc-400 text-center max-w-md mb-4">
              Select a pool from the{' '}
              <a href="/pools" className="text-emerald-400 hover:text-emerald-300">
                Pools page
              </a>{' '}
              to run historical backtests.
            </p>
            <p className="text-xs text-zinc-500 text-center max-w-lg">
              Backtests use real historical price data from CoinGecko to simulate how your LP position
              would have performed over any time period.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pool Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {selectedPool.token0.symbol} / {selectedPool.token1.symbol}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-zinc-500">Fee Tier</span>
                    <p className="font-mono text-white">{(selectedPool.fee / 10000).toFixed(2)}%</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">TVL</span>
                    <p className="font-mono text-white">${selectedPool.tvlUsd.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">24h Volume</span>
                    <p className="font-mono text-white">${selectedPool.volume24h.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Chain</span>
                    <p className="font-mono text-white">{CHAIN_NAMES[selectedChain]}</p>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-zinc-800">
                  <h4 className="text-sm font-medium text-zinc-300 mb-2">Backtest Configuration</h4>
                  <div className="text-xs text-zinc-500 space-y-1">
                    <p><span className="text-zinc-400">Token:</span> {tokenAddress.slice(0, 10)}...{tokenAddress.slice(-6)}</p>
                    <p><span className="text-zinc-400">Chain ID:</span> {chainId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Info Card */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  How Backtesting Works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400 space-y-2">
                <p>
                  Historical backtests simulate your LP strategy using real price data
                  from CoinGecko for the selected token.
                </p>
                <p>
                  <span className="text-zinc-300">Calculates:</span> Impermanent loss, fee earnings,
                  rebalancing impact, and compares to HODL performance.
                </p>
                <p className="text-amber-400/70">
                  Note: Free CoinGecko API has rate limits. For production use,
                  consider an API key for higher limits.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Backtest Runner */}
          <div className="lg:col-span-2">
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ) : (
              <BacktestRunner
                poolAddress={selectedPool.address}
                chainId={chainId}
                tokenAddress={tokenAddress}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
