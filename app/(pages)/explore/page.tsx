'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fetchPoolTVLs, formatTVL } from '@/lib/data/tvl';
import { CHAIN_NAMES } from '@/lib/constants';
import { PoolTVL } from '@/lib/data/tvl';
import { Search, Droplets, AlertCircle, RefreshCw, Check, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToken } from '@/hooks/useTokens';
import { useTokenPools } from '@/hooks/usePools';
import { isValidAddress } from '@/lib/data/tokens';
import Link from 'next/link';

export default function ExplorePage() {
  const { selectedChain } = useAppStore();
  const [pools, setPools] = useState<PoolTVL[]>([]);
  const [loading, setLoading] = useState(true);
  const [caInput, setCaInput] = useState('');
  const [resolvedCa, setResolvedCa] = useState<string | null>(null);

  // Token resolution
  const { data: tokenData, isLoading: isResolvingToken, error: tokenError } = useToken(
    selectedChain,
    resolvedCa
  );

  // Pool discovery by token
  const { data: tokenPools, isLoading: isLoadingPools, error: poolsError } = useTokenPools(
    selectedChain,
    resolvedCa
  );

  React.useEffect(() => {
    setLoading(true);
    fetchPoolTVLs(selectedChain).then((data) => {
      setPools(data);
      setLoading(false);
    });
  }, [selectedChain]);

  const handleCaSearch = () => {
    if (isValidAddress(caInput)) {
      setResolvedCa(caInput);
    }
  };

  const handleClear = () => {
    setCaInput('');
    setResolvedCa(null);
  };

  const isValidCa = isValidAddress(caInput);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Explore Pools</h1>
        <p className="text-sm text-[#888] mt-1">
          Discover Uniswap V3 pools on {CHAIN_NAMES[selectedChain] || 'Unknown Chain'}
        </p>
      </div>

      {/* Token Search by Contract Address */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              Search by Contract Address
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Paste any ERC20 token address to find all pools for that token
            </p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={caInput}
                onChange={(e) => setCaInput(e.target.value)}
                placeholder="0x..."
                className={cn(
                  'bg-zinc-950 border-zinc-800 text-zinc-100 font-mono text-sm pr-10',
                  caInput && !isValidCa && 'border-amber-500'
                )}
                onKeyDown={(e) => e.key === 'Enter' && handleCaSearch()}
              />
              {isResolvingToken && (
                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
              )}
              {tokenData && !isResolvingToken && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              )}
            </div>
            <Button
              onClick={handleCaSearch}
              disabled={!isValidCa || isResolvingToken}
              className={cn(
                isValidCa && !isResolvingToken
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-500'
              )}
            >
              Search
            </Button>
            {resolvedCa && (
              <Button variant="ghost" onClick={handleClear} className="text-zinc-400">
                Clear
              </Button>
            )}
          </div>

          {caInput && !isValidCa && (
            <p className="text-xs text-amber-400">Invalid Ethereum address format</p>
          )}

          {tokenError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-xs text-red-400">{tokenError.message}</p>
            </div>
          )}

          {/* Token Info */}
          {tokenData && (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
                {tokenData.symbol.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-400">{tokenData.name}</p>
                <p className="text-xs text-emerald-400/70">{tokenData.symbol} • {tokenData.decimals} decimals</p>
              </div>
              <a
                href={`https://etherscan.io/token/${tokenData.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-300"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Pool Results */}
          {isLoadingPools && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Discovering pools...
            </div>
          )}

          {poolsError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-xs text-red-400">{poolsError.message}</p>
            </div>
          )}

          {tokenPools && tokenPools.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 font-medium">{tokenPools.length} pool(s) found for {tokenData?.symbol}</p>
              <div className="grid gap-2">
                {tokenPools.map((pool) => (
                  <Link
                    key={pool.address}
                    href={`/strategy?pool=${pool.address}`}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-emerald-500/50 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center border border-zinc-800 text-white text-[9px] font-bold">
                          {pool.token0.symbol.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border border-zinc-800 text-white text-[9px] font-bold">
                          {pool.token1.symbol.slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <span className="text-sm text-zinc-200">
                        {pool.token0.symbol} / {pool.token1.symbol}
                      </span>
                      <Badge className="bg-zinc-700 text-zinc-300 border-zinc-600 text-[10px]">
                        {(pool.feeTier / 10000).toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="text-right">
                      {pool.tvlUSD !== undefined && (
                        <p className="text-xs text-zinc-400 font-mono">{formatTVL(pool.tvlUSD)} TVL</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {tokenPools && tokenPools.length === 0 && !isLoadingPools && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-amber-400">
                No pools found for this token. It may not have Uniswap V3 liquidity on {CHAIN_NAMES[selectedChain]}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Pools */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pools" value={loading ? '—' : pools.length.toString()} loading={loading} />
        <StatCard label="Total TVL" value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.tvlUSD, 0))} loading={loading} />
        <StatCard label="24h Volume" value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.volume24h, 0))} loading={loading} />
        <StatCard label="24h Fees" value={loading ? '—' : formatTVL(pools.reduce((s, p) => s + p.fees24h, 0))} loading={loading} />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-4 w-20 ml-auto" />
                  <div className="skeleton h-4 w-20" />
                </div>
              ))}
            </div>
          ) : pools.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pool</th>
                  <th>TVL</th>
                  <th>24h Volume</th>
                  <th>24h Fees</th>
                  <th>1d Change</th>
                </tr>
              </thead>
              <tbody>
                {pools.slice(0, 20).map((pool) => (
                  <tr key={pool.address}>
                    <td className="text-white font-medium">{pool.symbol}</td>
                    <td className="font-mono">{formatTVL(pool.tvlUSD)}</td>
                    <td className="font-mono text-[#ccc]">{formatTVL(pool.volume24h)}</td>
                    <td className="font-mono text-[#ccc]">{formatTVL(pool.fees24h)}</td>
                    <td>
                      <span className={`font-mono text-xs ${pool.change1d >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {pool.change1d >= 0 ? '+' : ''}{pool.change1d.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-[#555] text-sm">
              No pools found for this chain.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="card card-body">
      <div className="metric-label">{label}</div>
      {loading ? (
        <div className="skeleton h-8 w-24 mt-1" />
      ) : (
        <div className="metric-value mt-1">{value}</div>
      )}
    </div>
  );
}
