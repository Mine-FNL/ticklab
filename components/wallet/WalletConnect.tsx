'use client';

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function WalletConnect() {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-zinc-400">Loading wallet...</p>
        </CardContent>
      </Card>
    )
  }
  
  // Use RainbowKit's ConnectButton when available
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Wallet</CardTitle>
      </CardHeader>
      <CardContent>
        <ConnectButton
          showBalance={false}
          accountStatus="address"
          chainStatus="none"
        />
      </CardContent>
    </Card>
  )
}

// Standalone connect button for use outside RainbowKit provider context
export function StandaloneConnectButton({ className = '' }: { className?: string }) {
  const { isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return <Button className={className} disabled>Loading...</Button>
  }
  
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => (
        <div
          {...(!mounted && {
            'aria-hidden': true,
            'style': {
              opacity: 0,
              pointerEvents: 'none',
              userSelect: 'none',
            },
          })}
          className={className}
        >
          {(() => {
            if (!mounted || !account) {
              return (
                <Button onClick={openConnectModal} variant="default">
                  Connect Wallet
                </Button>
              )
            }
            
            return (
              <Button onClick={openAccountModal} variant="outline">
                {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </Button>
            )
          })()}
        </div>
      )}
    </ConnectButton.Custom>
  )
}