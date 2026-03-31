'use client';

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import type { Pool } from '@/types/strategy'
import { estimateFees, type FeeEstimate } from '@/lib/fee-model'
import { compareToHODL, type ComparisonResult, type LPStrategy, type HODLPosition } from '@/lib/lp-vs-hodl'
import { generateScenarioGrid, type ScenarioResult } from '@/lib/scenarios'
import { tickToSqrtPrice, getTokenAmountsFromLiquidity } from '@/lib/lp-math'

interface StrategyBuilderProps {
  pool: Pool
  currentTick: number
  sqrtPrice: bigint
  currentPrice: number
  onStrategyComplete?: (strategy: LPStrategy, results: ComparisonResult) => void
  onScenariosCalculated?: (scenarios: ScenarioResult[], lowerTick: number, upperTick: number) => void
}

export function StrategyBuilder({ pool, currentTick, sqrtPrice, currentPrice, onStrategyComplete, onScenariosCalculated }: StrategyBuilderProps) {
  const [depositAmount, setDepositAmount] = useState(10000)
  const [rangeWidth, setRangeWidth] = useState(10)
  const [depositMode, setDepositMode] = useState<'balanced' | 'token0-heavy' | 'token1-heavy'>('balanced')
  const [horizonDays, setHorizonDays] = useState(30)
  const [rebalanceMode, setRebalanceMode] = useState<'none' | 'periodic' | 'threshold' | 'volatility'>('none')
  
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([])
  const [lowerTick, setLowerTick] = useState<number>(0)
  const [upperTick, setUpperTick] = useState<number>(0)

  const calculateStrategy = () => {
    const priceFloat = Number(currentPrice)
    const tickSpacing = pool.feeTier === 100 ? 1 : pool.feeTier === 500 ? 10 : pool.feeTier === 3000 ? 60 : 200
    const rangeMultiplier = 1 + (rangeWidth / 100)
    const tickChange = Math.round(Math.log(rangeMultiplier) / Math.log(1.0001))
    
    const roundedTick = Math.floor(currentTick / tickSpacing) * tickSpacing
    const lower = roundedTick - tickChange
    const upper = roundedTick + tickChange
    
    setLowerTick(lower)
    setUpperTick(upper)
    
    const sqrtPriceLower = tickToSqrtPrice(lower)
    const sqrtPriceUpper = tickToSqrtPrice(upper)
    
    const liquidity = BigInt(Math.floor(depositAmount * 1e18 / priceFloat))
    const { amount0, amount1 } = getTokenAmountsFromLiquidity(
      sqrtPrice,
      sqrtPriceLower,
      sqrtPriceUpper,
      liquidity,
      false
    )
    
    const token0Amount = Number(amount0) / Math.pow(10, pool.token0.decimals)
    const token1Amount = Number(amount1) / Math.pow(10, pool.token1.decimals)
    
    const fees = estimateFees({
      volume24h: pool.volumeUSD24h || 1_000_000,
      feeTier: pool.feeTier,
      liquidity: pool.tvlUSD ?? 0,
      yourLiquidity: depositAmount,
      timeHorizonHours: horizonDays * 24,
      timeInRangePercent: 0.7,
    })
    
    const strategy: LPStrategy = {
      token0Amount,
      token1Amount,
      liquidity,
      entryPrice: priceFloat,
      lowerTick: lower,
      upperTick: upper,
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
    }
    
    const hodl: HODLPosition = {
      token0Amount,
      token1Amount,
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
    }
    
    const comp = compareToHODL(
      strategy,
      hodl,
      priceFloat,
      fees.baseVolume,
      50
    )
    
    const scen = generateScenarioGrid(priceFloat, {
      priceLow: priceFloat * 0.5,
      priceHigh: priceFloat * 3,
      priceSteps: 20,
      volumeLow: 0.5,
      volumeBase: 1,
      volumeHigh: 2,
      horizonDays: [7, 14, 30, 60, 90],
      rangeWidths: [0.05, 0.10, 0.20, 0.50],
    }, strategy)
    
    setFeeEstimate(fees)
    setComparison(comp)
    setScenarios(scen)

    // Fire callbacks so parent can update
    if (onStrategyComplete) {
      onStrategyComplete(strategy, comp)
    }
    if (onScenariosCalculated) {
      onScenariosCalculated(scen, lower, upper)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Data Quality Warning */}
      {(pool.tvlUSD ?? 0) < 100000 && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
          <p className="text-yellow-400 text-sm">
            ⚠️ Low liquidity pool (${((pool.tvlUSD ?? 0) / 1000).toFixed(0)}K TVL). Data may be unreliable.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Strategy Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Deposit Amount (USD)</label>
            <Input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">
              Range Width: ±{rangeWidth}%
            </label>
            <Slider
              value={[rangeWidth]}
              onValueChange={(v) => setRangeWidth(v[0])}
              min={1}
              max={100}
              step={1}
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>Narrow (±1%)</span>
              <span>Wide (±100%)</span>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Deposit Mode</label>
            <select
              value={depositMode}
              onChange={(e) => setDepositMode(e.target.value as typeof depositMode)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="balanced">Balanced (50/50)</option>
              <option value="token0-heavy">Token0 Heavy (75/25)</option>
              <option value="token1-heavy">Token1 Heavy (25/75)</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Time Horizon: {horizonDays} days</label>
            <Slider
              value={[horizonDays]}
              onValueChange={(v) => setHorizonDays(v[0])}
              min={1}
              max={90}
              step={1}
            />
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Rebalance Mode</label>
            <select
              value={rebalanceMode}
              onChange={(e) => setRebalanceMode(e.target.value as typeof rebalanceMode)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="none">No Rebalancing</option>
              <option value="periodic">Periodic (weekly)</option>
              <option value="threshold">Threshold-based</option>
              <option value="volatility">Volatility-triggered</option>
            </select>
          </div>
          
          <Button onClick={calculateStrategy} className="w-full">
            Calculate Strategy
          </Button>
        </CardContent>
      </Card>
      
      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">LP vs HODL Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-zinc-900 rounded-lg">
                <p className="text-sm text-zinc-400">LP Return</p>
                <p className={`text-2xl font-mono ${comparison.lpReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {comparison.lpReturn.toFixed(2)}%
                </p>
              </div>
              <div className="text-center p-4 bg-zinc-900 rounded-lg">
                <p className="text-sm text-zinc-400">HODL Return</p>
                <p className="text-2xl font-mono text-zinc-300">
                  {comparison.hodlReturn.toFixed(2)}%
                </p>
              </div>
            </div>
            
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Fees Earned</span>
                <span className="text-emerald-400 font-mono">+${comparison.feesEarned.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">IL Loss</span>
                <span className="text-red-400 font-mono">-${comparison.ilLoss.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Net Result</span>
                <span className={`font-mono ${comparison.netResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {comparison.netResult >= 0 ? '+' : ''}{comparison.netResult.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-800">
                <span className="text-zinc-400">Break-even Fees</span>
                <span className="font-mono">${comparison.breakEvenFees.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {feeEstimate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fee Estimates ({horizonDays} days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-zinc-500">Low Volume</p>
                <p className="text-lg font-mono text-zinc-300">${feeEstimate.lowVolume.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500">Base Volume</p>
                <p className="text-lg font-mono text-emerald-400">${feeEstimate.baseVolume.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500">High Volume</p>
                <p className="text-lg font-mono text-emerald-400">${feeEstimate.highVolume.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              Time in range: {(feeEstimate.timeInRange * 100).toFixed(0)}% assumed
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
