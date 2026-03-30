'use client';

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PositionList } from '@/components/wallet/PositionList'
import { useAppStore } from '@/lib/store'
import type { LPPosition } from '@/lib/wallet'
import { isPositionInRange } from '@/lib/wallet'

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export default function PositionsPage() {
  const { address, isConnected } = useAccount()
  const { selectedChain } = useAppStore()
  const [selectedPosition, setSelectedPosition] = useState<LPPosition | null>(null)
  
  // Mock tick for demo (in production, fetch from pool)
  const currentTick = 200000 // Example tick
  
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Live Positions</h1>
            <p className="text-zinc-400">
              Monitor and manage your active LP positions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton.Custom>
              {({ account, openConnectModal }) => (
                account ? (
                  <span className="text-sm text-emerald-400 font-mono">
                    {account.address.slice(0, 6)}...{account.address.slice(-4)}
                  </span>
                ) : null
              )}
            </ConnectButton.Custom>
          </div>
        </div>

        {/* Connection Status / Wallet */}
        <Card className="mb-8 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  {isConnected ? (
                    <>
                      <div className="font-semibold">Wallet Connected</div>
                      <div className="text-sm text-zinc-400 font-mono">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">Wallet Not Connected</div>
                      <div className="text-sm text-zinc-400">
                        Connect your wallet to view and manage your positions
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ConnectButton />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Summary (only shown when connected) */}
        {isConnected && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-sm text-zinc-400 mb-1">Total Value</div>
                <div className="text-2xl font-bold">—</div>
                <div className="text-xs text-zinc-500">Connect to see</div>
              </CardContent>
            </Card>
            <Card className="border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-sm text-zinc-400 mb-1">Unclaimed Fees</div>
                <div className="text-2xl font-bold text-emerald-400">—</div>
                <div className="text-xs text-zinc-500">Across all positions</div>
              </CardContent>
            </Card>
            <Card className="border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-sm text-zinc-400 mb-1">Total P&L</div>
                <div className="text-2xl font-bold text-emerald-400">—</div>
                <div className="text-xs text-emerald-400">—</div>
              </CardContent>
            </Card>
            <Card className="border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-sm text-zinc-400 mb-1">In Range</div>
                <div className="text-2xl font-bold text-emerald-400">—</div>
                <div className="text-xs text-zinc-500">Positions active</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Positions List */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Positions</h2>
          {isConnected ? (
            <PositionList onSelectPosition={setSelectedPosition} />
          ) : (
            <Card className="border-zinc-800">
              <CardContent className="p-8 text-center">
                <p className="text-zinc-400 mb-4">Connect your wallet to view your Uniswap V3 LP positions</p>
                <ConnectButton />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Position Detail Modal (when selected) */}
        {selectedPosition && (
          <Card className="mb-8 border-emerald-600">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Position Details: {selectedPosition.symbol0}/{selectedPosition.symbol1}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPosition(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Position Info */}
                <div className="space-y-4">
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-xs text-zinc-400 mb-1">Fee Tier</div>
                    <div className="font-semibold">{(selectedPosition.feeTier / 100).toFixed(2)}%</div>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-xs text-zinc-400 mb-1">Tick Range</div>
                    <div className="font-semibold font-mono">
                      {selectedPosition.tickLower} → {selectedPosition.tickUpper}
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-xs text-zinc-400 mb-1">Liquidity</div>
                    <div className="font-semibold font-mono">
                      {Number(selectedPosition.liquidity).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-xs text-zinc-400 mb-1">Status</div>
                    <div className={`font-semibold ${
                      isPositionInRange(currentTick, selectedPosition.tickLower, selectedPosition.tickUpper)
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}>
                      {isPositionInRange(currentTick, selectedPosition.tickLower, selectedPosition.tickUpper)
                        ? 'In Range'
                        : 'Out of Range'}
                    </div>
                  </div>
                </div>

                {/* Token Composition */}
                <div className="space-y-4">
                  <h4 className="text-sm text-zinc-400">Unclaimed Fees</h4>
                  <div className="p-3 bg-emerald-900/20 border border-emerald-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{selectedPosition.symbol0}</span>
                      <span className="font-semibold text-emerald-400">
                        {Number(selectedPosition.tokensOwed0) / Math.pow(10, selectedPosition.decimals0 || 18):.4f}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-900/20 border border-emerald-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{selectedPosition.symbol1}</span>
                      <span className="font-semibold text-emerald-400">
                        {Number(selectedPosition.tokensOwed1) / Math.pow(10, selectedPosition.decimals1 || 18):.4f}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}