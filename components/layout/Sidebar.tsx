'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  SlidersHorizontal,
  History,
  Wallet,
  Library,
  GitCompare,
  HelpCircle,
  FileText,
} from 'lucide-react';

const navigation = [
  { name: 'Explore', href: '/explore', icon: Compass },
  { name: 'Strategy Builder', href: '/strategy', icon: SlidersHorizontal },
  { name: 'Backtest', href: '/backtest', icon: History },
  { name: 'Positions', href: '/positions', icon: Wallet },
  { name: 'Compare', href: '/compare', icon: GitCompare },
  { name: 'Library', href: '/library', icon: Library },
];

const resources = [
  { name: 'Documentation', href: '/docs', icon: FileText },
  { name: 'Help & Support', href: '/help', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block fixed left-0 top-16 w-64 h-[calc(100vh-64px)] bg-zinc-900/50 border-r border-zinc-800 overflow-y-auto">
      <nav className="p-4 space-y-8">
        {/* Main Navigation */}
        <div>
          <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Tools
          </p>
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    pathname === item.href || pathname.startsWith(item.href + '/')
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Resources */}
        <div>
          <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Resources
          </p>
          <ul className="space-y-1">
            {resources.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded-lg transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="px-3 py-4 bg-zinc-800/30 rounded-lg">
          <p className="text-xs text-zinc-500 leading-relaxed">
            All projections are estimates based on historical data. 
            Past performance does not guarantee future results. 
            Always DYOR.
          </p>
        </div>
      </nav>
    </aside>
  );
}
