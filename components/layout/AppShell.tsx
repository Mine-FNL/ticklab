'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-0 lg:ml-64 min-h-[calc(100vh-64px)]">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
