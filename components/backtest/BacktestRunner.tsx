'use client';

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BacktestParams, BacktestResult, runBacktest, fetchPriceHistory } from '@/lib/backtest'
import { AlertCircle, TrendingUp, TrendingDown, Clock, RefreshCw, DollarSign } from 'lucide-react'

interface BacktestRunnerProps {
  poolAddress: string
  chainId: number
  tokenAddress: string
}

export function BacktestRunner({ poolAddress, chainId, tokenAddress }: BacktestRunnerProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [startDate, setStartDate] = useState('2024-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [lowerTick, setLowerTick] = useState(-1000)
  const [upperTick, setUpperTick] = useState(1000)
  const [depositUSD, setDepositUSD] = useState(10000)
  const [rebalanceMode, setRebalanceMode] = useState<'none' | 'threshold'>('none')
  
  const runBacktestHandler = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    
    try {
      // Fetch price history
      const prices = await fetchPriceHistory(
        tokenAddress,
        chainId,
        new Date(startDate),
        new Date(endDate)
      )
      
      if (prices.length < 2) {
        throw new Error('Insufficient price history. Need at least 2 data points.')
      }
      
      // Run backtest
      const params: BacktestParams = {
        poolAddress,
        chainId,
        lowerTick,
        upperTick,
        depositUSD,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        rebalanceMode,
        gasCostPerRebalance: 50,
      }
      
      const backtestResult = await runBacktest(params, prices)
      setResult(backtestResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest failed')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Backtest Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historical Backtest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Lower Tick</label>
              <Input
                type="number"
                value={lowerTick}
                onChange={(e) => setLowerTick(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Upper Tick</label>
              <Input
                type="number"
                value={upperTick}
                onChange={(e) => setUpperTick(Number(e.target.value))}
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mb-1 block">Deposit (USD)</label>
            <Input
              type="number"
              value={depositUSD}
              onChange={(e) => setDepositUSD(Number(e.target.value))}
            />
          </div>
          
          <div>
            <label className="text-sm text-zinc-400 mb-1 block">Rebalance Mode</label>
            <select
              value={rebalanceMode}
              onChange={(e) => setRebalanceMode(e.target.value as 'none' | 'threshold')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2"
            >
              <option value="none">No Rebalancing</option>
              <option value="threshold">Threshold-based</option>
            </select>
          </div>
          
          <Button 
            onClick={runBacktestHandler} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              'Run Backtest'
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Error */}
      {error && (
        <Card className="border-red-900 bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-medium">{error}</p>
                <p className="text-xs text-zinc-500 mt-2">
                  Note: Historical backtest requires CoinGecko token ID mapping.
                  Add token addresses to the mapping in lib/data/coingecko.ts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className={result.netReturn >= 0 ? 'border-emerald-900 bg-emerald-950/20' : 'border-red-900 bg-red-950/20'}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">LP Return</span>
                  {result.netReturn >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <p className={`text-2xl font-mono font-bold mt-1 ${result.netReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.netReturn >= 0 ? '+' : ''}{result.netReturn.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-zinc-900/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">HODL Return</span>
                  <DollarSign className="h-4 w-4 text-zinc-500" />
                </div>
                <p className="text-2xl font-mono font-bold mt-1 text-zinc-300">
                  {result.hodlReturn >= 0 ? '+' : ''}{result.hodlReturn.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Excess Return */}
          <Card className={result.excessReturn >= 0 ? 'border-emerald-900/50' : 'border-red-900/50'}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Excess Return (LP vs HODL)</span>
                <span className={`font-mono font-bold ${result.excessReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.excessReturn >= 0 ? '+' : ''}{result.excessReturn.toFixed(2)}%
                </span>
              </div>
            </CardContent>
          </Card>
          
          {/* Detailed Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Total Fees Earned
                  </span>
                  <span className="text-emerald-400 font-mono font-medium">
                    +${result.totalFees.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-400 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-400" />
                    Total Impermanent Loss
                  </span>
                  <span className="text-red-400 font-mono font-medium">
                    -${result.totalIL.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-400 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-blue-400" />
                    Rebalances Executed
                  </span>
                  <span className="text-zinc-300 font-mono font-medium">
                    {result.rebalanceCount}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-400 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    Time In Range
                  </span>
                  <span className="text-zinc-300 font-mono font-medium">
                    {(result.timeInRangePercent * 100).toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-400">Time Out of Range</span>
                  <span className="text-zinc-500 font-mono">
                    {(result.timeOutOfRangePercent * 100).toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-400">Gas Costs (Est.)</span>
                  <span className="text-red-400 font-mono">
                    -${result.totalGasCost.toFixed(2)}
                  </span>
                </div>
                
                {result.sharpeRatio !== undefined && (
                  <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                    <span className="text-zinc-400">Sharpe Ratio</span>
                    <span className="text-zinc-300 font-mono">
                      {result.sharpeRatio.toFixed(2)}
                    </span>
                  </div>
                )}
                
                {result.maxDrawdown !== undefined && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-zinc-400">Max Drawdown</span>
                    <span className="text-red-400 font-mono">
                      -{result.maxDrawdown.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Daily Data Table */}
          {result.dailyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Snapshots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left py-2 text-zinc-400 font-medium">Date</th>
                        <th className="text-right py-2 text-zinc-400 font-medium">Price</th>
                        <th className="text-right py-2 text-zinc-400 font-medium">LP Value</th>
                        <th className="text-right py-2 text-zinc-400 font-medium">HODL</th>
                        <th className="text-right py-2 text-zinc-400 font-medium">Fees</th>
                        <th className="text-right py-2 text-zinc-400 font-medium">IL</th>
                        <th className="text-center py-2 text-zinc-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.dailyData.slice(-30).map((snapshot, i) => (
                        <tr key={i} className="border-b border-zinc-800/50">
                          <td className="py-2 text-zinc-300 font-mono text-xs">
                            {snapshot.date.toLocaleDateString()}
                          </td>
                          <td className="py-2 text-right text-zinc-300 font-mono">
                            ${snapshot.price.toFixed(2)}
                          </td>
                          <td className={`py-2 text-right font-mono ${snapshot.lpValue >= (result.depositUSD ?? 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${snapshot.lpValue.toFixed(2)}
                          </td>
                          <td className="py-2 text-right text-zinc-400 font-mono">
                            ${snapshot.hodlValue.toFixed(2)}
                          </td>
                          <td className="py-2 text-right text-emerald-400 font-mono">
                            +${snapshot.feesCumulative.toFixed(2)}
                          </td>
                          <td className="py-2 text-right text-red-400 font-mono">
                            -${snapshot.ilCumulative.toFixed(2)}
                          </td>
                          <td className="py-2 text-center">
                            {snapshot.inRange ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-900/50 text-emerald-400">
                                In Range
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-400">
                                Out
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.dailyData.length > 30 && (
                    <p className="text-xs text-zinc-500 mt-2 text-center">
                      Showing last 30 days of {result.dailyData.length} total
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
