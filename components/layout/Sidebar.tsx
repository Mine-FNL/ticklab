'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  SlidersHorizontal,
  History,
  Wallet,
  Library,
  GitCompare,
  ArrowLeftRight,
  Pool,
  TrendingUp,
  Droplets,
  Menu,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Explore', href: '/explore', icon: Compass },
  { name: 'Strategy', href: '/strategy', icon: SlidersHorizontal },
  { name: 'Backtest', href: '/backtest', icon: History },
  { name: 'Swaps', href: '/swaps', icon: ArrowLeftRight },
  { name: 'Pools', href: '/pools', icon: Pool },
  { name: 'TVL', href: '/tvl', icon: TrendingUp },
  { name: 'Liquidity', href: '/liquidity', icon: Droplets },
  { name: 'Positions', href: '/positions', icon: Wallet },
  { name: 'Compare', href: '/compare', icon: GitCompare },
  { name: 'Library', href: '/library', icon: Library },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="lg:hidden fixed top-[70px] left-3 z-50 p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X className="w-5 h-5 text-zinc-300" />
        ) : (
          <Menu className="w-5 h-5 text-zinc-300" />
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed left-0 top-[98px] w-56 h-[calc(100vh-98px)] bg-[#0a0a0a] border-r border-[#1f1f1f] overflow-y-auto">
        <nav className="p-3 space-y-0.5">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? 'bg-[#1a1a1a] text-white font-medium'
                    : 'text-[#888] hover:text-white hover:bg-[#111]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 w-56 h-full bg-[#0a0a0a] border-r border-[#1f1f1f] overflow-y-auto z-50 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ top: '0' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#1f1f1f]">
          <span className="text-sm font-semibold text-white">Menu</span>
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <nav className="p-3 space-y-0.5">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? 'bg-[#1a1a1a] text-white font-medium'
                    : 'text-[#888] hover:text-white hover:bg-[#111]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
