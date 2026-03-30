'use client';

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MonteCarloParams, MonteCarloResult, runMonteCarlo } from '@/lib/monte-carlo'
import { EquityCurveChart } from '@/components/charts/EquityCurveChart'

interface MonteCarloRunnerProps {
  entryPrice: number
  lowerTick: number
  upperTick: number
  poolTVL: number
  feeTier: number
}

export function MonteCarloRunner({ 
  entryPrice, lowerTick, upperTick, poolTVL, feeTier 
}: MonteCarloRunnerProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Simulation parameters
  const [simulations, setSimulations] = useState(1000)
  const [days, setDays] = useState(30)
  const [volatility, setVolatility] = useState(0.03)  // 3% daily
  const [drift, setDrift] = useState(0.0002)  // ~7% annual drift
  const [dailyVolume, setDailyVolume] = useState(poolTVL * 0.1)  // 10% of TVL daily volume
  const [depositUSD, setDepositUSD] = useState(10000)
  const [meanReversion, setMeanReversion] = useState(0.1)  // 10% mean reversion
  
  const runSimulation = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params: MonteCarloParams = {
        entryPrice,
        lowerTick,
        upperTick,
        depositUSD,
        feeTier,
        liquidity: poolTVL,
        simulations,
        days,
        dailyVolume,
        volatilityDaily: volatility,
        driftDaily: drift,
        meanReversionStrength: meanReversion,
        targetPrice: entryPrice,
      }
      
      const mcResult = await runMonteCarlo(params)
      setResult(mcResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Simulations</label>
              <Input
                type="number"
                value={simulations}
                onChange={(e) => setSimulations(Number(e.target.value))}
                min={100}
                max={10000}
              />
              <span className="text-xs text-zinc-500 mt-1 block">
                More = slower but smoother
              </span>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Days</label>
              <Input
                type="number"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                min={1}
                max={365}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Daily Volatility</label>
              <Input
                type="number"
                value={volatility}
                onChange={(e) => setVolatility(Number(e.target.value))}
                step={0.001}
                min={0}
              />
              <span className="text-xs text-zinc-500">{(volatility * 100).toFixed(1)}% daily</span>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Daily Drift</label>
              <Input
                type="number"
                value={drift}
                onChange={(e) => setDrift(Number(e.target.value))}
                step={0.0001}
              />
              <span className="text-xs text-zinc-500">Annual: ~{(drift * 365 * 100).toFixed(1)}%</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Mean Reversion</label>
              <Input
                type="number"
                value={meanReversion}
                onChange={(e) => setMeanReversion(Number(e.target.value))}
                step={0.01}
                min={0}
                max={1}
              />
              <span className="text-xs text-zinc-500">0 = none, 1 = full</span>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Deposit (USD)</label>
              <Input
                type="number"
                value={depositUSD}
                onChange={(e) => setDepositUSD(Number(e.target.value))}
                min={100}
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mb-1 block">Daily Volume (USD)</label>
            <Input
              type="number"
              value={dailyVolume}
              onChange={(e) => setDailyVolume(Number(e.target.value))}
            />
            <span className="text-xs text-zinc-500">~{(dailyVolume / poolTVL * 100).toFixed(1)}% of TVL/day</span>
          </div>
          
          <Button 
            onClick={runSimulation} 
            disabled={loading} 
            className="w-full bg-emerald-600 hover:bg-emerald-500"
          >
            {loading ? (
              <>
                <span className="mr-2">Running {simulations} simulations...</span>
              </>
            ) : (
              `Run Monte Carlo (${simulations}x)`
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Error */}
      {error && (
        <Card className="border-red-900">
          <CardContent className="p-4">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Results ({simulations} simulations, {days} days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500">Median Return</p>
                  <p className={`text-xl font-mono ${result.medianReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.medianReturn.toFixed(2)}%
                  </p>
                </div>
                <div className="text-center p-3 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500">Mean Return</p>
                  <p className={`text-xl font-mono ${result.meanReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.meanReturn.toFixed(2)}%
                  </p>
                </div>
                <div className="text-center p-3 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500">Std Deviation</p>
                  <p className="text-xl font-mono text-zinc-300">
                    {result.stdDev.toFixed(2)}%
                  </p>
                </div>
              </div>
              
              {/* Percentiles */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">10th Percentile (Worst)</span>
                  <span className="font-mono text-red-400">{result.p10.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">25th Percentile</span>
                  <span className="font-mono text-zinc-300">{result.p25.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">50th Percentile (Median)</span>
                  <span className="font-mono text-emerald-400">{result.p50.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">75th Percentile</span>
                  <span className="font-mono text-zinc-300">{result.p75.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">90th Percentile (Best)</span>
                  <span className="font-mono text-emerald-400">{result.p90.toFixed(2)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Probabilities */}
          <Card>
            <CardHeader>
              <CardTitle>Probabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-zinc-900 rounded-lg">
                  <p className="text-sm text-zinc-400">Profit Probability</p>
                  <p className="text-2xl font-mono text-emerald-400">
                    {(result.probProfit * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-4 bg-zinc-900 rounded-lg">
                  <p className="text-sm text-zinc-400">Beat HODL</p>
                  <p className="text-2xl font-mono text-emerald-400">
                    {(result.probBeatingHODL * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-zinc-900/50 rounded-lg">
                  <p className="text-xs text-zinc-500">Loss Probability</p>
                  <p className="text-lg font-mono text-red-400">
                    {result.lossPercent.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-3 bg-zinc-900/50 rounded-lg">
                  <p className="text-xs text-zinc-500">Sharpe Ratio</p>
                  <p className={`text-lg font-mono ${result.sharpeRatio >= 1 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {result.sharpeRatio.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Equity Curve Chart */}
          {result.paths.length > 0 && (
            <EquityCurveChart paths={result.paths} days={days} />
          )}
          
          {/* Distribution Histogram */}
          <Card>
            <CardHeader>
              <CardTitle>Return Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-end gap-1">
                {Array.from({ length: 20 }).map((_, i) => {
                  const range = result.p90 - result.p10
                  const bucketStart = result.p10 + (range * i / 20)
                  const bucketEnd = result.p10 + (range * (i + 1) / 20)
                  const bucketMid = (bucketStart + bucketEnd) / 2
                  
                  const count = result.paths.filter(p => 
                    p.netReturn >= bucketStart && p.netReturn < bucketEnd
                  ).length
                  
                  const height = (count / result.paths.length) * 100
                  const color = bucketMid < 0 ? 'bg-red-600' : bucketMid > 5 ? 'bg-emerald-600' : 'bg-zinc-500'
                  
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${color} hover:opacity-70 transition-opacity cursor-pointer`}
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${bucketMid.toFixed(1)}%: ${count} paths`}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-zinc-500 mt-2">
                <span>{result.p10.toFixed(1)}%</span>
                <span className="text-zinc-400">0%</span>
                <span>{result.p90.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Top/Bottom Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle>Scenario Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-red-950/30 rounded">
                  <span className="text-red-400">Worst Case (P10)</span>
                  <span className="font-mono text-red-300">{result.p10.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                  <span className="text-zinc-400">Median (P50)</span>
                  <span className="font-mono text-zinc-300">{result.p50.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between p-2 bg-emerald-950/30 rounded">
                  <span className="text-emerald-400">Best Case (P90)</span>
                  <span className="font-mono text-emerald-300">{result.p90.toFixed(2)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
