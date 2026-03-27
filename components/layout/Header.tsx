'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Beaker, Menu, Settings, Bell, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore, useSelectedChain } from '@/lib/store';
import { SUPPORTED_CHAINS, CHAIN_NAMES } from '@/lib/constants';

export function Header() {
  const router = useRouter();
  const selectedChain = useSelectedChain();
  const { selectChain } = useAppStore();

  const handleChainChange = (chainId: number) => {
    selectChain(chainId);
    // Reset selected pool when changing chains
    useAppStore.getState().selectPool(null);
  };

  const currentChain = SUPPORTED_CHAINS.find(c => c.id === selectedChain);

  return (
    <header className="sticky top-0 z-50 h-16 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-violet-500 rounded-lg flex items-center justify-center">
              <Beaker className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-zinc-100 hidden sm:block">
              UniV3 LP Lab
            </span>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            <NavLink href="/explore">Explore</NavLink>
            <NavLink href="/strategy">Strategy</NavLink>
            <NavLink href="/backtest">Backtest</NavLink>
            <NavLink href="/positions">Positions</NavLink>
            <NavLink href="/library">Library</NavLink>
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Chain Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden sm:flex gap-2 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {currentChain?.name || 'Ethereum'}
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 min-w-[160px]">
              {SUPPORTED_CHAINS.map((chain) => (
                <DropdownMenuItem
                  key={chain.id}
                  onClick={() => handleChainChange(chain.id)}
                  className={`cursor-pointer ${selectedChain === chain.id ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'}`}
                >
                  <span className={`w-2 h-2 rounded-full mr-2 ${selectedChain === chain.id ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                  {chain.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings */}
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
            <Settings className="w-5 h-5" />
          </Button>

          {/* Wallet Connect */}
          <ConnectButton
            showBalance={false}
            accountStatus="address"
            chainStatus="icon"
          />

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden text-zinc-400">
                <Menu className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
              <DropdownMenuItem asChild>
                <Link href="/explore">Explore</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/strategy">Strategy</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/backtest">Backtest</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/positions">Positions</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/library">Library</Link>
              </DropdownMenuItem>
              <div className="border-t border-zinc-800 my-1"></div>
              {SUPPORTED_CHAINS.map((chain) => (
                <DropdownMenuItem
                  key={chain.id}
                  onClick={() => handleChainChange(chain.id)}
                  className={selectedChain === chain.id ? 'text-emerald-400' : ''}
                >
                  {chain.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800/50 transition-colors"
    >
      {children}
    </Link>
  );
}
