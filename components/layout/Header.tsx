'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ChevronDown, BarChart3 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { SUPPORTED_CHAINS } from '@/lib/constants';

const NAV_TABS = [
  { label: 'Strategy', href: '/strategy' },
  { label: 'Swaps', href: '/swaps' },
  { label: 'Pools', href: '/pools' },
  { label: 'TVL', href: '/tvl' },
  { label: 'Liquidity', href: '/liquidity' },
];

export function Header() {
  const pathname = usePathname();
  const { selectedChain, setSettings } = useAppStore();
  const [chainOpen, setChainOpen] = useState(false);

  const currentChain = SUPPORTED_CHAINS.find((c) => c.id === selectedChain) || SUPPORTED_CHAINS[0];

  return (
    <header className="sticky top-0 z-50 h-14 bg-[#0d0d0d] border-b border-[#1f1f1f]">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-gradient-to-br from-[#10b981] to-[#059669] rounded-md flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white hidden sm:block tracking-tight">
              UniV3 Lab
            </span>
          </Link>

          {/* Top-level Nav tabs */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_TABS.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`nav-tab ${isActive ? 'active' : ''}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Chain selector + Wallet */}
        <div className="flex items-center gap-2">
          {/* Chain Selector */}
          <div className="relative">
            <button
              onClick={() => setChainOpen(!chainOpen)}
              className="chain-btn"
            >
              <span>{currentChain.icon}</span>
              <span className="hidden sm:inline">{currentChain.name}</span>
              <ChevronDown className="w-3 h-3 text-[#555]" />
            </button>

            {chainOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setChainOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden min-w-[160px]">
                  {SUPPORTED_CHAINS.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => {
                        setSettings({ defaultChainId: chain.id });
                        setChainOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#222] transition-colors ${
                        selectedChain === chain.id ? 'text-[#10b981]' : 'text-[#ccc]'
                      }`}
                    >
                      <span>{chain.icon}</span>
                      <span>{chain.name}</span>
                      {selectedChain === chain.id && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Wallet */}
          <ConnectButton
            showBalance={false}
            accountStatus="address"
            chainStatus="none"
          />
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar />
    </header>
  );
}

function StatsBar() {
  return (
    <div className="stats-bar">
      <div className="stats-bar-item">
        <span className="stats-bar-label">Chain</span>
        <span className="stats-bar-value">Ethereum</span>
      </div>
      <div className="stats-bar-item">
        <span className="stats-bar-label">Pools</span>
        <span className="stats-bar-value">—</span>
      </div>
      <div className="stats-bar-item">
        <span className="stats-bar-label">TVL</span>
        <span className="stats-bar-value">—</span>
      </div>
      <div className="stats-bar-item">
        <span className="stats-bar-label">24h Volume</span>
        <span className="stats-bar-value">—</span>
      </div>
      <div className="stats-bar-item">
        <span className="stats-bar-label">24h Swaps</span>
        <span className="stats-bar-value">—</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse-dot" />
        <span className="text-xs text-[#555]">Live</span>
      </div>
    </div>
  );
}
