/**
 * V4StrategyBuilder - Uniswap V4 Strategy Configuration
 * 
 * Combines V4 pool selection, hook selection, range configuration,
 * and simulation into a unified strategy builder.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Calculator, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { V4PoolSelector } from './V4PoolSelector';
import { HookSelector } from './HookSelector';
import type { V4Pool } from '@/lib/univ4/pool';
import { simulateV4LP, optimizeV4Range } from '@/lib/univ4/simulation';
import { calculateV4OptimalRange } from '@/lib/univ4/math';
import { V4ScenarioPoint } from '@/lib/univ4/simulation';
import { FEE_TIER_LABELS } from '@/lib/constants';

export function V4StrategyBuilder() {
  const [selectedPool, setSelectedPool] = useState<V4Pool | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  
  // Strategy params
  const [depositAmount, setDepositAmount] = useState<string>('1000');
  const [lowerPrice, setLowerPrice] = useState<string>('');
  const [upperPrice, setUpperPrice] = useState<string>('');
  const [volatility, setVolatility] = useState<number>(0.8);
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [volume24h, setVolume24h] = useState<string>('');
  
  // Results
  const [simulation, setSimulation] = useState<ReturnType<typeof simulateV4LP> | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const currentPrice = useMemo(() => {
    if (!selectedPool?.currentSqrtPriceX96) return 0;
    const sqrtPrice = Number(BigInt(selectedPool.currentSqrtPriceX96)) / 2 ** 96;
    return sqrtPrice * sqrtPrice;
  }, [selectedPool]);

  const handleAutoRange = useCallback(() => {
    if (!currentPrice) return;
    const range = calculateV4OptimalRange(currentPrice, volatility, 0.95);
    setLowerPrice(range.lowerPrice.toFixed(6));
    setUpperPrice(range.upperPrice.toFixed(6));
  }, [currentPrice, volatility]);

  const handleOptimizeForHook = useCallback(() => {
    if (!currentPrice) return;
    const range = optimizeV4Range({
      currentPrice,
      volatility,
      hookId: selectedHookId || undefined,
      targetTimeInRange: 0.75,
    });
    setLowerPrice(range.lowerPrice.toFixed(6));
    setUpperPrice(range.upperPrice.toFixed(6));
  }, [currentPrice, volatility, selectedHookId]);

  const handleSimulate = useCallback(() => {
    if (!selectedPool || !currentPrice || !lowerPrice || !upperPrice) return;
    
    setIsSimulating(true);
    
    // Use pool TVL as proxy for poolLiquidity
    const poolLiquidity = BigInt(selectedPool.currentLiquidity || '1000000000000000000');
    const userLiquidity = BigInt(Math.floor(Number(depositAmount) * 1e18));
    const vol = Number(volume24h) || (selectedPool.volumeUSD24h || 100000);

    const result = simulateV4LP({
      entryPrice: currentPrice,
      lowerPrice: Number(lowerPrice),
      upperPrice: Number(upperPrice),
      depositAmount: Number(depositAmount),
      depositToken: 'usd',
      baseFeeTier: selectedPool.feeTier,
      volume24h: vol,
      poolLiquidity,
      yourLiquidity: userLiquidity,
      horizonDays,
      gasCostGwei: 20,
      hookId: selectedHookId || undefined,
      volatility,
      estimatedDailySwaps: Math.max(1, Math.floor(vol / 50000)),
    });

    setSimulation(result);
    setIsSimulating(false);
  }, [selectedPool, currentPrice, lowerPrice, upperPrice, depositAmount, volume24h, horizonDays, selectedHookId, volatility]);

  const isReady = selectedPool && lowerPrice && upperPrice && Number(depositAmount) > 0;

  return (
    <div className="space-y-6">
      {/* Pool Selection */}
      <V4PoolSelector
        chainId={selectedPool?.chainId || 1}
        onPoolSelect={setSelectedPool}
        selectedPool={selectedPool}
      />

      {/* Selected Pool Info */}
      {selectedPool && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {selectedPool.token0.symbol} / {selectedPool.token1.symbol}
              <span className="text-xs text-zinc-500 font-normal">
                V4 • {FEE_TIER_LABELS[selectedPool.feeTier]}
              </span>
              {selectedPool.hookAddress && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                  Hook Pool
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Current Price</span>
                <p className="font-mono text-white">{currentPrice.toFixed(6)}</p>
              </div>
              <div>
                <span className="text-zinc-500">Current Tick</span>
                <p className="font-mono text-white">{selectedPool.currentTick ?? '—'}</p>
              </div>
              <div>
                <span className="text-zinc-500">Tick Spacing</span>
                <p className="font-mono text-white">{selectedPool.tickSpacing}</p>
              </div>
              <div>
                <span className="text-zinc-500">Pool ID</span>
                <p className="font-mono text-zinc-400 text-xs truncate">{selectedPool.poolId}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hook Selection */}
      {selectedPool && (
        <HookSelector
          chainId={selectedPool.chainId}
          baseAPR={0.15} // placeholder, would be calculated from pool metrics
          volatility={volatility}
          onHookSelect={setSelectedHookId}
          selectedHookId={selectedHookId}
        />
      )}

      {/* Range & Deposit Configuration */}
      {selectedPool && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Position Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Deposit Amount */}
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Deposit Amount (USD)</label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
                placeholder="1000"
              />
            </div>

            {/* Volume Override */}
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">24h Volume (USD) — optional override</label>
              <Input
                type="number"
                value={volume24h}
                onChange={(e) => setVolume24h(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
                placeholder={selectedPool.volumeUSD24h?.toString() || '100000'}
              />
            </div>

            {/* Volatility Slider */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm text-zinc-400">Expected Volatility (annualized)</label>
                <span className="text-sm text-zinc-300">{(volatility * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[volatility]}
                onValueChange={([v]) => setVolatility(v)}
                min={0.1}
                max={3}
                step={0.05}
                className="w-full"
              />
            </div>

            {/* Horizon */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm text-zinc-400">Time Horizon</label>
                <span className="text-sm text-zinc-300">{horizonDays} days</span>
              </div>
              <Slider
                value={[horizonDays]}
                onValueChange={([v]) => setHorizonDays(v)}
                min={1}
                max={365}
                step={1}
                className="w-full"
              />
            </div>

            {/* Range Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Lower Price</label>
                <Input
                  type="number"
                  value={lowerPrice}
                  onChange={(e) => setLowerPrice(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  placeholder={currentPrice ? (currentPrice * 0.8).toFixed(6) : '0'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Upper Price</label>
                <Input
                  type="number"
                  value={upperPrice}
                  onChange={(e) => setUpperPrice(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  placeholder={currentPrice ? (currentPrice * 1.2).toFixed(6) : '0'}
                />
              </div>
            </div>

            {/* Auto Range Buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoRange}
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 text-xs"
              >
                Auto Range (95% confidence)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleOptimizeForHook}
                disabled={!selectedHookId}
                className="border-amber-700 text-amber-400 hover:bg-amber-950/30 text-xs"
              >
                Optimize for Hook
              </Button>
            </div>

            {/* Simulate Button */}
            <Button
              onClick={handleSimulate}
              disabled={!isReady || isSimulating}
              className={cn(
                'w-full',
                isReady && !isSimulating
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              )}
            >
              {isSimulating ? (
                'Simulating...'
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculate V4 Strategy
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Simulation Results */}
      {simulation && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Simulation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hook Analysis */}
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Hook Analysis</span>
                {simulation.hookAnalysis.hookName && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {simulation.hookAnalysis.hookName}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-300 mb-2">{simulation.hookAnalysis.recommendation}</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-zinc-900/50 rounded">
                  <span className="text-zinc-500">Base APR</span>
                  <p className="text-zinc-200">{(simulation.hookAnalysis.baseAPR * 100).toFixed(2)}%</p>
                </div>
                <div className="p-2 bg-zinc-900/50 rounded">
                  <span className="text-zinc-500">Hook Adj.</span>
                  <p className={simulation.hookAnalysis.hookAdjustedAPR > simulation.hookAnalysis.baseAPR ? 'text-emerald-400' : 'text-zinc-200'}>
                    {(simulation.hookAnalysis.hookAdjustedAPR * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="p-2 bg-zinc-900/50 rounded">
                  <span className="text-zinc-500">Risk Score</span>
                  <p className="text-zinc-200">{simulation.hookAnalysis.riskScore}/100</p>
                </div>
              </div>
            </div>

            {/* Range Analysis */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-zinc-800/50 rounded-lg">
                <span className="text-zinc-500">Tick Width</span>
                <p className="text-zinc-200 font-mono">{simulation.rangeAnalysis.tickWidth}</p>
              </div>
              <div className="p-2 bg-zinc-800/50 rounded-lg">
                <span className="text-zinc-500">Time in Range</span>
                <p className="text-zinc-200">{(simulation.rangeAnalysis.estimatedTimeInRange * 100).toFixed(1)}%</p>
              </div>
              <div className="p-2 bg-zinc-800/50 rounded-lg">
                <span className="text-zinc-500">Flow Capture</span>
                <p className="text-zinc-200">
                  {simulation.baseCase ? `$${simulation.baseCase.flowCapture.toFixed(0)}` : '—'}
                </p>
              </div>
            </div>

            {/* Scenario Summary */}
            {simulation.baseCase && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                <ScenarioMetric label="Base Case P&L" value={`$${simulation.baseCase.netReturn.toFixed(2)}`} />
                <ScenarioMetric label="Best Case" value={`$${simulation.bestCase?.netReturn.toFixed(2) || '0'}`} positive />
                <ScenarioMetric label="Worst Case" value={`$${simulation.worstCase?.netReturn.toFixed(2) || '0'}`} negative />
                <ScenarioMetric label="Fees (base)" value={`$${simulation.baseCase.feesEarned.toFixed(2)}`} />
              </div>
            )}

            {/* Scenario Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 text-zinc-500 font-medium">Price Change</th>
                    <th className="text-right py-2 text-zinc-500 font-medium">LP Value</th>
                    <th className="text-right py-2 text-zinc-500 font-medium">Fees</th>
                    <th className="text-right py-2 text-zinc-500 font-medium">Net Return</th>
                    <th className="text-right py-2 text-zinc-500 font-medium">In Range</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.scenarios.filter((_, i) => i % 5 === 0).map((s, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      <td className="py-1.5 text-zinc-300">{s.priceChangePercent >= 0 ? '+' : ''}{s.priceChangePercent.toFixed(1)}%</td>
                      <td className="py-1.5 text-right text-zinc-300">${s.lpValue.toFixed(2)}</td>
                      <td className="py-1.5 text-right text-zinc-300">${s.feesEarned.toFixed(2)}</td>
                      <td className={cn('py-1.5 text-right', s.netReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {s.netReturn >= 0 ? '+' : ''}${s.netReturn.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px]',
                          s.inRange ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        )}>
                          {s.inRange ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScenarioMetric({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="p-2 bg-zinc-800/50 rounded-lg">
      <span className="text-zinc-500">{label}</span>
      <p className={cn(
        'font-mono',
        positive && 'text-emerald-400',
        negative && 'text-red-400',
        !positive && !negative && 'text-zinc-200'
      )}>
        {value}
      </p>
    </div>
  );
}
