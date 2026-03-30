'use client';

import { useMemo } from 'react'
import type { ScenarioResult } from '@/lib/scenarios'

interface ScenarioChartProps {
  scenarios: ScenarioResult[]
  entryPrice: number
}

export function ScenarioChart({ scenarios, entryPrice }: ScenarioChartProps) {
  const chartData = useMemo(() => {
    if (!scenarios.length) return []
    
    const sorted = [...scenarios].sort((a, b) => a.priceMovePercent - b.priceMovePercent)
    const sampled = sorted.filter((_, i) => i % 5 === 0)
    
    const minReturn = Math.min(...sampled.map(s => Math.min(s.netReturn * 100, s.hodlReturn * 100)))
    const maxReturn = Math.max(...sampled.map(s => Math.max(s.netReturn * 100, s.hodlReturn * 100)))
    const range = maxReturn - minReturn || 1
    
    return sampled.map(s => ({
      x: ((s.priceMovePercent + 1) / 2) * 100,
      lpY: 90 - ((s.netReturn * 100 - minReturn) / range) * 80,
      hodlY: 90 - ((s.hodlReturn * 100 - minReturn) / range) * 80,
      priceMovePercent: s.priceMovePercent * 100,
      netReturn: s.netReturn * 100,
      hodlReturn: s.hodlReturn * 100,
    }))
  }, [scenarios])
  
  if (!chartData.length) {
    return (
      <div className="h-[400px] flex items-center justify-center text-zinc-500">
        No scenario data available
      </div>
    )
  }
  
  const pathLP = chartData.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${d.x} ${d.lpY}`
  ).join(' ')
  
  const pathHODL = chartData.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${d.x} ${d.hodlY}`
  ).join(' ')
  
  return (
    <div className="h-[400px] w-full bg-zinc-900 rounded-lg p-4">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lpGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        <rect x="0" y="0" width="100" height="100" fill="#18181b" />
        
        <line x1="0" y1="50" x2="100" y2="50" stroke="#27272a" strokeWidth="0.5" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#fbbf24" strokeWidth="0.3" strokeDasharray="2,2" />
        
        {[-50, -25, 0, 25, 50, 75, 100, 125, 150, 175, 200].map(p => {
          const x = ((p + 100) / 300) * 100
          return x >= 0 && x <= 100 ? (
            <text key={p} x={x} y="98" fill="#71717a" fontSize="2" textAnchor="middle">
              {p > 0 ? `+${p}%` : `${p}%`}
            </text>
          ) : null
        })}
        
        <path
          d={pathHODL}
          fill="none"
          stroke="#6366f1"
          strokeWidth="0.5"
        />
        
        <path
          d={pathLP + ` L ${chartData[chartData.length-1]?.x || 100} 100 L ${chartData[0]?.x || 0} 100 Z`}
          fill="url(#lpGradient)"
        />
        <path
          d={pathLP}
          fill="none"
          stroke="#10b981"
          strokeWidth="0.5"
        />
        
        <circle cx="50" cy="50" r="1" fill="#fbbf24" />
      </svg>
      
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-emerald-500" />
          <span className="text-xs text-zinc-400">LP Net Return</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-indigo-500" />
          <span className="text-xs text-zinc-400">HODL Return</span>
        </div>
      </div>
    </div>
  )
}
