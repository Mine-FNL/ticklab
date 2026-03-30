'use client';

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchUserPositions, type LPPosition, isPositionInRange, formatUnclaimedFees } from '@/lib/wallet'
import { getRangeState } from '@/lib/lp-math'
import { useAppStore } from '@/lib/store'

interface PositionListProps {
  onSelectPosition?: (position: LPPosition) => void
  className?: string
}

export function PositionList({ onSelectPosition, className = '' }: PositionListProps) {
  const { address, isConnected } = useAccount()
  const { selectedChain } = useAppStore()
  
  const [currentTick, setCurrentTick] = useState<number>(0)
  
  // Fetch positions
  const {
    data: positions,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wallet-positions', selectedChain, address],
    queryFn: () => fetchUserPositions(address as `0x${string}`, selectedChain),
    enabled: isConnected && !!address,
    staleTime: 60 * 1000, // 1 minute
  })
  
  // Simulated current tick (in real app, fetch from pool)
  useEffect(() => {
    if (positions && positions.length > 0) {
      // Use the first position's tick as current for demo
      // In production, fetch from the actual pool's slot0
      setCurrentTick(Math.floor((positions[0].tickLower + positions[0].tickUpper) / 2))
    }
  }, [positions])
  
  if (!isConnected || !address) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <p className="text-zinc-400 text-sm">Connect wallet to view positions</p>
        </CardContent>
      </Card>
    )
  }
  
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
            <span className="ml-2 text-zinc-400 text-sm">Loading positions...</span>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (error) {
    return (
      <Card className={`border-red-900 ${className}`}>
        <CardContent className="p-4">
          <p className="text-red-400 text-sm">{(error as Error).message}</p>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  if (!positions || positions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <p className="text-zinc-400 text-sm">No LP positions found on this chain</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{positions.length} Position(s)</p>
        <Button onClick={() => refetch()} variant="ghost" size="sm">
          Refresh
        </Button>
      </div>
      
      {positions.map((position) => {
        const inRange = isPositionInRange(currentTick, position.tickLower, position.tickUpper)
        const rangeState = getRangeState(currentTick, position.tickLower, position.tickUpper)
        
        return (
          <Card
            key={position.tokenId.toString()}
            className={`cursor-pointer hover:border-emerald-600 transition-colors ${
              inRange ? 'border-emerald-600' : 'border-zinc-800'
            }`}
            onClick={() => onSelectPosition?.(position)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">
                    {position.symbol0}/{position.symbol1}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {(position.feeTier / 100).toFixed(2)}%
                  </span>
                </div>
                <div className={`text-xs px-2 py-1 rounded ${
                  inRange ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'
                }`}>
                  {inRange ? 'In Range' : rangeState === 'below-range' ? 'Below' : 'Above'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                <div>
                  <span className="text-zinc-500">Liquidity:</span>{' '}
                  <span className="font-mono">{Number(position.liquidity).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Tick Range:</span>{' '}
                  <span className="font-mono">{position.tickLower} → {position.tickUpper}</span>
                </div>
              </div>
              
              {(position.tokensOwed0 > 0n || position.tokensOwed1 > 0n) && (
                <div className="mt-2 pt-2 border-t border-zinc-800">
                  <p className="text-xs text-emerald-400">
                    Unclaimed Fees: {formatUnclaimedFees(position)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}