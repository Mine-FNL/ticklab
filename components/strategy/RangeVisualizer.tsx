'use client';

interface RangeVisualizerProps {
  lowerTick: number
  upperTick: number
  currentTick: number
  token0Symbol: string
  token1Symbol: string
}

export function RangeVisualizer({ lowerTick, upperTick, currentTick, token0Symbol, token1Symbol }: RangeVisualizerProps) {
  const range = upperTick - lowerTick
  const position = range !== 0 ? ((currentTick - lowerTick) / range) * 100 : 50
  
  return (
    <div className="bg-zinc-900 rounded-lg p-4">
      <div className="flex justify-between text-xs text-zinc-500 mb-2">
        <span>{token1Symbol} min</span>
        <span>{token1Symbol} max</span>
      </div>
      <div className="relative h-8 bg-zinc-800 rounded-full overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900/30" />
        <div
          className="absolute top-0 bottom-0 w-1 bg-yellow-400"
          style={{ left: `${Math.max(0, Math.min(100, position))}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-2">
        <span className="font-mono text-zinc-400">
          {lowerTick} ticks
        </span>
        <span className={`font-mono ${position < 20 ? 'text-red-400' : position > 80 ? 'text-zinc-400' : 'text-emerald-400'}`}>
          Current: {currentTick} ({position.toFixed(1)}% from bottom)
        </span>
        <span className="font-mono text-zinc-400">
          {upperTick} ticks
        </span>
      </div>
    </div>
  )
}
