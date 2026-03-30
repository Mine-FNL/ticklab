'use client';

import { SimulationPath } from '@/lib/monte-carlo'

interface EquityCurveChartProps {
  paths: SimulationPath[]
  days: number
}

/**
 * Equity Curve Visualization for Monte Carlo Simulation Results
 * Shows percentile-based return scenarios as horizontal bar charts
 */
export function EquityCurveChart({ paths, days }: EquityCurveChartProps) {
  if (paths.length === 0) return null
  
  // Sort paths by net return for percentile extraction
  const sortedByReturn = [...paths].sort((a, b) => a.netReturn - b.netReturn)
  
  // Get percentile paths
  const p10 = sortedByReturn[Math.floor(paths.length * 0.1)]
  const p25 = sortedByReturn[Math.floor(paths.length * 0.25)]
  const p50 = sortedByReturn[Math.floor(paths.length * 0.5)]
  const p75 = sortedByReturn[Math.floor(paths.length * 0.75)]
  const p90 = sortedByReturn[Math.floor(paths.length * 0.9)]
  
  // Calculate max absolute return for scaling
  const maxAbsReturn = Math.max(
    Math.abs(p10?.netReturn || 0),
    Math.abs(p90?.netReturn || 0),
    Math.abs(p50?.netReturn || 0)
  )
  
  const scalePercent = (value: number) => {
    const pct = (Math.abs(value) / maxAbsReturn) * 50
    return Math.min(100, Math.max(2, pct))
  }
  
  return (
    <div className="bg-zinc-900 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">LP Return Scenarios</h3>
      
      {/* Scenario bars */}
      <div className="space-y-4">
        {/* P90 (Best) */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-emerald-400">90th Percentile (Best)</span>
            <span className="font-mono text-emerald-400">
              {p90?.netReturn ? `+${p90.netReturn.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          <div className="h-5 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${scalePercent(p90?.netReturn || 0)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>In range: {((p90?.inRangePercent || 0) * 100).toFixed(0)}%</span>
            <span>Fees: ${((p90?.feesEarned || 0)).toFixed(0)}</span>
          </div>
        </div>
        
        {/* P75 */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400">75th Percentile</span>
            <span className="font-mono text-zinc-400">
              {p75?.netReturn ? `+${p75.netReturn.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-zinc-600 transition-all"
              style={{ width: `${scalePercent(p75?.netReturn || 0)}%` }}
            />
          </div>
        </div>
        
        {/* P50 (Median) */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-300">50th Percentile (Median)</span>
            <span className={`font-mono ${(p50?.netReturn || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {p50?.netReturn !== undefined ? `${p50.netReturn >= 0 ? '+' : ''}${p50.netReturn.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          <div className="h-5 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${(p50?.netReturn || 0) >= 0 ? 'bg-zinc-500' : 'bg-red-700'}`}
              style={{ width: `${scalePercent(p50?.netReturn || 0)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>In range: {((p50?.inRangePercent || 0) * 100).toFixed(0)}%</span>
            <span>Fees: ${((p50?.feesEarned || 0)).toFixed(0)}</span>
          </div>
        </div>
        
        {/* P25 */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400">25th Percentile</span>
            <span className="font-mono text-zinc-400">
              {p25?.netReturn !== undefined ? `${p25.netReturn >= 0 ? '+' : ''}${p25.netReturn.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${(p25?.netReturn || 0) >= 0 ? 'bg-zinc-600' : 'bg-red-600'}`}
              style={{ width: `${scalePercent(p25?.netReturn || 0)}%` }}
            />
          </div>
        </div>
        
        {/* P10 (Worst) */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-400">10th Percentile (Worst)</span>
            <span className="font-mono text-red-400">
              {p10?.netReturn !== undefined ? `${p10.netReturn >= 0 ? '+' : ''}${p10.netReturn.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          <div className="h-5 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-600 transition-all"
              style={{ width: `${scalePercent(p10?.netReturn || 0)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>In range: {((p10?.inRangePercent || 0) * 100).toFixed(0)}%</span>
            <span>Fees: ${((p10?.feesEarned || 0)).toFixed(0)}</span>
          </div>
        </div>
      </div>
      
      {/* Summary stats */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <p className="text-zinc-500">Peak Return (P90)</p>
            <p className="font-mono text-emerald-400">
              {p90?.peakReturn ? `+${p90.peakReturn.toFixed(1)}%` : 'N/A'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-zinc-500">Avg In-Range</p>
            <p className="font-mono text-zinc-300">
              {((paths.reduce((sum, p) => sum + p.inRangePercent, 0) / paths.length) * 100).toFixed(0)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-zinc-500">Trough Return (P10)</p>
            <p className="font-mono text-red-400">
              {p10?.troughReturn ? `${p10.troughReturn.toFixed(1)}%` : 'N/A'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-3 text-xs text-zinc-600">
        Based on {paths.length} simulation paths over {days} days
      </div>
    </div>
  )
}
