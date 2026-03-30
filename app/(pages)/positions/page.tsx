'use client';

import { useState } from 'react'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { PositionList } from '@/components/wallet/PositionList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PositionsPage() {
  const [selectedChain, setSelectedChain] = useState(1) // Ethereum default
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">My Positions</h1>
        <p className="text-zinc-400">Connect wallet to view your Uniswap V3 LP positions</p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Wallet Connection */}
        <div className="space-y-6">
          <WalletConnect />
          
          {/* Chain Selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Select Chain</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100"
              >
                <option value={1}>Ethereum</option>
                <option value={42161}>Arbitrum</option>
                <option value={8453}>Base</option>
                <option value={10}>Optimism</option>
                <option value={137}>Polygon</option>
              </select>
            </CardContent>
          </Card>
        </div>
        
        {/* Right: Position List */}
        <div className="lg:col-span-2">
          <PositionList 
            chainId={selectedChain} 
            currentTick={0}
          />
        </div>
      </div>
    </div>
  )
}
