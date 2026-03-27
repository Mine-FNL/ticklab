'use client';

/**
 * Strategy Builder Page - REAL Data Only
 * 
 * Build and simulate LP strategies with:
 * - Real pool discovery via factory contract
 * - Real-time prices from RPC
 * - Real historical data from CoinGecko
 */

import React, { useState } from 'react';
import { Calculator, ArrowRight, TrendingUp, AlertCircle, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PoolSelector } from '@/components/strategy/PoolSelector';
import { useSelectedChain, useAppStore } from '@/lib/store';
import { usePoolState } from '@/hooks/usePoolState';
import { useBacktest, usePriceHistory } from '@/hooks/useBacktest';
import { FEE_TIER_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Pool } from '@/types';

export default function StrategyPage() {
  const chainId = useSelectedChain();
  const { selectPool } = useAppStore();
  
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [lowerPrice, setLowerPrice] = useState('');
  const [upperPrice, setUpperPrice] = useState('');
  const [horizonDays, setHorizonDays] = useState(30);
  const [backtestResult, setBacktestResult] = useState<any>(null);

  // Fetch pool state when pool is selected
  const { data: poolState, isLoading: isPoolStateLoading } = usePoolState(
    chainId,
    selectedPool?.address || null
  );

  // Fetch price history for backtest
  const { data: priceHistory, isLoading: isPriceHistoryLoading } = usePriceHistory(
    selectedPool?.token0.address || null,
    selectedPool?.token1.address || null,
    horizonDays
  );

  // Backtest mutation
  const backtest = useBacktest();

  // Calculate current price from pool state
  const currentPrice = poolState?.token1Price || 0;

  // Check if form is valid
  const isFormValid = selectedPool && depositAmount && lowerPrice && upperPrice;

  const handlePoolSelect = (pool: Pool | null) => {
    setSelectedPool(pool);
    selectPool(pool);
    setBacktestResult(null);
  };

  const handleRunBacktest = async () => {
    if (!selectedPool || !isFormValid) return;

    try {
      const result = await backtest.mutateAsync({
        chainId,
        poolAddress: selectedPool.address,
        startDate: new Date(Date.now() - horizonDays * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        depositAmount: parseFloat(depositAmount),
        lowerPrice: parseFloat(lowerPrice),
        upperPrice: parseFloat(upperPrice),
        depositToken: 'usd',
      });
      
      setBacktestResult(result);
    } catch (error) {
      console.error('Backtest failed:', error);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-zinc-100">
                Strategy Builder
              </h1>
              <p className="text-zinc-500 text-sm">
                Build LP strategies with real on-chain data
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Pool Discovery */}
          <div className="space-y-6">
            <PoolSelector
              chainId={chainId}
              onPoolSelect={handlePoolSelect}
              selectedPool={selectedPool}
            />

            {/* Price History Preview */}
            {selectedPool && priceHistory && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Price History ({horizonDays} days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isPriceHistoryLoading ? (
                    <div className="space-y-2">
                      <div className="h-24 bg-zinc-800 animate-pulse rounded" />
                    </div>
                  ) : priceHistory?.priceRatios?.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Start Price</span>
                        <span className="text-zinc-300">
                          {priceHistory.priceRatios[0]?.price.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">End Price</span>
                        <span className="text-zinc-300">
                          {priceHistory.priceRatios[priceHistory.priceRatios.length - 1]?.price.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Price Change</span>
                        <span className={cn(
                          priceHistory.priceRatios[priceHistory.priceRatios.length - 1]?.price > priceHistory.priceRatios[0]?.price
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        )}>
                          {((priceHistory.priceRatios[priceHistory.priceRatios.length - 1]?.price / priceHistory.priceRatios[0]?.price - 1) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Data Points</span>
                        <span className="text-zinc-300">{priceHistory.priceRatios.length}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>Price history unavailable</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Strategy Configuration */}
          <div className="space-y-6">
            {/* Deposit Input */}
            <Card className={cn(
              'bg-zinc-900/50 border-zinc-800',
              !selectedPool && 'opacity-50'
            )}>
              <CardHeader>
                <CardTitle className="text-lg text-zinc-100">
                  Deposit Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      disabled={!selectedPool}
                      className="bg-zinc-950 border-zinc-800 text-zinc-100 text-lg"
                    />
                  </div>
                  <Badge variant="secondary" className="self-center bg-zinc-800">
                    USD
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Price Range */}
            <Card className={cn(
              'bg-zinc-900/50 border-zinc-800',
              !selectedPool && 'opacity-50 pointer-events-none'
            )}>
              <CardHeader>
                <CardTitle className="text-lg text-zinc-100">
                  Price Range
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-zinc-500 mb-2 block">
                      Lower Price
                    </label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={lowerPrice}
                      onChange={(e) => setLowerPrice(e.target.value)}
                      disabled={!selectedPool}
                      className="bg-zinc-950 border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-500 mb-2 block">
                      Upper Price
                    </label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={upperPrice}
                      onChange={(e) => setUpperPrice(e.target.value)}
                      disabled={!selectedPool}
                      className="bg-zinc-950 border-zinc-800 text-zinc-100"
                    />
                  </div>
                </div>
                
                {currentPrice > 0 && (
                  <div className="mt-4 p-4 bg-zinc-950 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-500">Current Price</span>
                      <span className="text-emerald-400 font-medium">
                        {currentPrice.toFixed(6)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden relative">
                      {/* Range indicator */}
                      {lowerPrice && upperPrice && (
                        <div 
                          className="absolute h-full bg-emerald-500/30 rounded-full"
                          style={{
                            left: `${Math.max(0, Math.min(100, (parseFloat(lowerPrice) / currentPrice - 0.5) * 50 + 50))}%`,
                            right: `${Math.max(0, 100 - Math.min(100, (parseFloat(upperPrice) / currentPrice - 0.5) * 50 + 50))}%`,
                          }}
                        />
                      )}
                      {/* Current price marker */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-emerald-400"
                        style={{ left: '50%' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-600 mt-1">
                      <span>50% below</span>
                      <span>Current</span>
                      <span>50% above</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Time Horizon */}
            <Card className={cn(
              'bg-zinc-900/50 border-zinc-800',
              !selectedPool && 'opacity-50'
            )}>
              <CardHeader>
                <CardTitle className="text-lg text-zinc-100">
                  Time Horizon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    value={horizonDays}
                    onChange={(e) => setHorizonDays(Number(e.target.value))}
                    disabled={!selectedPool}
                    min={1}
                    max={365}
                    className="w-24 bg-zinc-950 border-zinc-800 text-zinc-100"
                  />
                  <span className="text-zinc-400">days</span>
                  <div className="flex gap-2 ml-auto">
                    {[7, 30, 90, 180, 365].map((days) => (
                      <Button
                        key={days}
                        variant={horizonDays === days ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setHorizonDays(days)}
                        disabled={!selectedPool}
                        className={horizonDays === days 
                          ? 'bg-emerald-500 hover:bg-emerald-600' 
                          : 'border-zinc-700 bg-zinc-800/50'}
                      >
                        {days === 365 ? '1Y' : `${days}d`}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Run Backtest Button */}
            <Button
              size="lg"
              disabled={!isFormValid || backtest.isPending}
              onClick={handleRunBacktest}
              className={cn(
                'w-full',
                isFormValid && !backtest.isPending
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              )}
            >
              {backtest.isPending ? (
                <>
                  <TrendingUp className="w-5 h-5 mr-2 animate-pulse" />
                  Running Backtest...
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Run Backtest
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            {/* Backtest Error */}
            {backtest.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400 font-medium">
                      Backtest failed
                    </p>
                    <p className="text-xs text-red-400/70 mt-1">
                      {backtest.error instanceof Error 
                        ? backtest.error.message 
                        : 'Failed to run backtest'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Backtest Results */}
            {backtestResult && (
              <Card className="bg-zinc-900/50 border-emerald-500/30">
                <CardHeader>
                  <CardTitle className="text-lg text-emerald-400">
                    Backtest Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-zinc-950 rounded-lg">
                      <p className="text-xs text-zinc-500">Total Return</p>
                      <p className={cn(
                        'text-xl font-bold',
                        backtestResult.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {(backtestResult.totalReturn * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-lg">
                      <p className="text-xs text-zinc-500">vs HODL</p>
                      <p className={cn(
                        'text-xl font-bold',
                        backtestResult.excessReturn >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {(backtestResult.excessReturn * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-lg">
                      <p className="text-xs text-zinc-500">Fees Earned</p>
                      <p className="text-xl font-bold text-emerald-400">
                        ${backtestResult.totalFees.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-lg">
                      <p className="text-xs text-zinc-500">Time in Range</p>
                      <p className="text-xl font-bold text-zinc-300">
                        {(backtestResult.timeInRange * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedPool && (
              <div className="text-center py-8 text-zinc-500">
                <Droplets className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Discover a pool to start building your strategy</p>
                <p className="text-sm text-zinc-600 mt-1">
                  Enter two token addresses to find a Uniswap V3 pool
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
