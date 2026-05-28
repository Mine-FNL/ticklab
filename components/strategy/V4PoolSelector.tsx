/**
 * V4PoolSelector - Uniswap V4 Pool Discovery
 * 
 * Discovers V4 pools by PoolKey. Supports both pair-based and single-token search.
 * Shows hook-attached pools distinctly.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Search, Zap, AlertCircle, RefreshCw, Check, X, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToken } from '@/hooks/useTokens';
import { useV4PoolDiscovery, useV4PoolsByToken } from '@/hooks/useV4Pools';
import { FEE_TIER_LABELS } from '@/lib/constants';
import { isValidAddress } from '@/lib/data/tokens';
import type { V4Pool } from '@/lib/univ4/pool';
import { HOOK_REGISTRY } from '@/lib/univ4/hooks';

export interface V4PoolSelectorProps {
  chainId: number;
  onPoolSelect: (pool: V4Pool | null) => void;
  selectedPool?: V4Pool | null;
  className?: string;
}

function TokenInput({
  label,
  value,
  onChange,
  onResolve,
  resolvedToken,
  isResolving,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onResolve: () => void;
  resolvedToken: { symbol: string; name: string; decimals: number } | null;
  isResolving: boolean;
  error: Error | null;
  disabled?: boolean;
}) {
  const isValidFormat = isValidAddress(value);
  const showResolve = value.length === 42 && isValidFormat && !resolvedToken && !isResolving;

  return (
    <div className="space-y-2">
      <label className="text-sm text-zinc-400">{label}</label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0x..."
          disabled={disabled}
          className={cn(
            'bg-zinc-950 border-zinc-800 text-zinc-100 font-mono text-sm pr-24',
            error && 'border-red-500',
            resolvedToken && 'border-emerald-500',
            value && !isValidFormat && 'border-amber-500'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isResolving && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
          {resolvedToken && !isResolving && <Check className="w-4 h-4 text-emerald-500" />}
          {showResolve && (
            <Button size="sm" variant="ghost" onClick={onResolve}
              className="h-6 px-2 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
              Resolve
            </Button>
          )}
        </div>
      </div>
      {resolvedToken && (
        <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
            {resolvedToken.symbol.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-400 truncate">{resolvedToken.name}</p>
            <p className="text-xs text-emerald-400/70">{resolvedToken.symbol} • {resolvedToken.decimals} decimals</p>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error.message}</p>}
      {value && !isValidFormat && !error && (
        <p className="text-xs text-amber-400">Invalid Ethereum address format</p>
      )}
    </div>
  );
}

export function V4PoolSelector({
  chainId,
  onPoolSelect,
  selectedPool,
  className,
}: V4PoolSelectorProps) {
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [mode, setMode] = useState<'pair' | 'single'>('pair');
  const [manualResolveA, setManualResolveA] = useState(false);
  const [manualResolveB, setManualResolveB] = useState(false);

  const { data: tokenAData, isLoading: isResolvingA, error: tokenAError, refetch: refetchTokenA } = useToken(
    chainId,
    (manualResolveA || tokenA.length === 42) && isValidAddress(tokenA) ? tokenA : null
  );
  const { data: tokenBData, isLoading: isResolvingB, error: tokenBError, refetch: refetchTokenB } = useToken(
    chainId,
    (manualResolveB || tokenB.length === 42) && isValidAddress(tokenB) ? tokenB : null
  );

  const {
    data: pairPools,
    isLoading: isDiscoveringPair,
    error: pairError,
    refetch: refetchPair,
  } = useV4PoolDiscovery(
    chainId,
    tokenAData?.address || null,
    tokenBData?.address || null
  );

  const {
    data: singleTokenPools,
    isLoading: isDiscoveringSingle,
    error: singleError,
    refetch: refetchSingle,
  } = useV4PoolsByToken(
    chainId,
    tokenAData?.address || null
  );

  const pools = mode === 'pair' ? (pairPools || []) : (singleTokenPools || []);
  const isDiscovering = mode === 'pair' ? isDiscoveringPair : isDiscoveringSingle;
  const discoveryError = mode === 'pair' ? pairError : singleError;
  const refetchPools = mode === 'pair' ? refetchPair : refetchSingle;

  const handleResolveA = useCallback(() => { setManualResolveA(true); refetchTokenA(); }, [refetchTokenA]);
  const handleResolveB = useCallback(() => { setManualResolveB(true); refetchTokenB(); }, [refetchTokenB]);

  const handleDiscover = useCallback(async () => {
    if (!tokenAData) { setManualResolveA(true); await refetchTokenA(); }
    if (mode === 'pair' && !tokenBData) { setManualResolveB(true); await refetchTokenB(); }
    await refetchPools();
  }, [tokenAData, tokenBData, refetchTokenA, refetchTokenB, refetchPools, mode]);

  const handleClear = useCallback(() => {
    setTokenA('');
    setTokenB('');
    setManualResolveA(false);
    setManualResolveB(false);
    onPoolSelect(null);
  }, [onPoolSelect]);

  const isValidInput = mode === 'pair'
    ? isValidAddress(tokenA) && isValidAddress(tokenB) && tokenA.toLowerCase() !== tokenB.toLowerCase()
    : isValidAddress(tokenA);

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              V4 Pool Discovery
            </h3>
            <p className="text-xs text-zinc-500">Discover Uniswap V4 pools by PoolKey</p>
          </div>
          {selectedPool && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-zinc-400">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('pair')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-1',
              mode === 'pair'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            )}
          >
            Token Pair
          </button>
          <button
            onClick={() => setMode('single')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-1',
              mode === 'single'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            )}
          >
            Single Token (CA)
          </button>
        </div>

        {/* Token A Input */}
        <TokenInput
          label={mode === 'single' ? 'Token Contract Address' : 'Token A Address'}
          value={tokenA}
          onChange={(v) => { setTokenA(v); setManualResolveA(false); }}
          onResolve={handleResolveA}
          resolvedToken={tokenAData ?? null}
          isResolving={isResolvingA}
          error={tokenAError}
          disabled={!!selectedPool}
        />

        {/* Token B Input (pair mode only) */}
        {mode === 'pair' && (
          <TokenInput
            label="Token B Address"
            value={tokenB}
            onChange={(v) => { setTokenB(v); setManualResolveB(false); }}
            onResolve={handleResolveB}
            resolvedToken={tokenBData ?? null}
            isResolving={isResolvingB}
            error={tokenBError}
            disabled={!!selectedPool}
          />
        )}

        {/* Discover Button */}
        {!selectedPool && (
          <Button
            onClick={handleDiscover}
            disabled={!isValidInput || isDiscovering || isResolvingA || isResolvingB}
            className={cn(
              'w-full',
              isValidInput && !isDiscovering && !isResolvingA && !isResolvingB
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            )}
          >
            {isResolvingA || isResolvingB ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Resolving...</>
            ) : isDiscovering ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Querying V4 PoolManager...</>
            ) : (
              <><Search className="w-4 h-4 mr-2" />Find V4 Pools</>
            )}
          </Button>
        )}

        {/* Error State */}
        {discoveryError && !isDiscovering && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-400 font-medium">Discovery failed</p>
                <p className="text-xs text-red-400/70 mt-1">{discoveryError.message}</p>
                <Button variant="outline" size="sm" onClick={() => refetchPools()}
                  className="mt-3 border-red-500/30 text-red-400 hover:bg-red-500/10">
                  <RefreshCw className="w-4 h-4 mr-2" />Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Pool Results */}
        {pools.length > 0 && !selectedPool && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-medium">{pools.length} pool(s) found</p>
            {pools.map((pool) => (
              <button
                key={pool.poolId}
                onClick={() => onPoolSelect(pool)}
                className="w-full text-left p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-emerald-500/50 hover:bg-zinc-800 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center border-2 border-zinc-800 text-white text-[10px] font-bold">
                        {pool.token0.symbol.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-2 border-zinc-800 text-white text-[10px] font-bold">
                        {pool.token1.symbol.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">
                        {pool.token0.symbol} / {pool.token1.symbol}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {pool.poolId.slice(0, 10)}...{pool.poolId.slice(-6)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="bg-zinc-700 text-zinc-300 border-zinc-600 text-[10px]">
                      {FEE_TIER_LABELS[pool.feeTier]}
                    </Badge>
                    {pool.hookAddress && pool.hookAddress !== '0x0000000000000000000000000000000000000000' && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                        Hook
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected Pool */}
        {selectedPool && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center border-2 border-zinc-800 text-white text-sm font-bold">
                    {selectedPool.token0.symbol.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-2 border-zinc-800 text-white text-sm font-bold">
                    {selectedPool.token1.symbol.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-zinc-100">{selectedPool.token0.symbol} / {selectedPool.token1.symbol}</p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {selectedPool.poolId.slice(0, 8)}...{selectedPool.poolId.slice(-6)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {FEE_TIER_LABELS[selectedPool.feeTier]}
                </Badge>
                {selectedPool.hookAddress && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                    Hook Attached
                  </Badge>
                )}
              </div>
            </div>
            {selectedPool.currentTick !== undefined && (
              <div className="pt-2 border-t border-zinc-800/50 text-sm">
                <span className="text-zinc-500">Current Tick: </span>
                <span className="font-mono text-zinc-300">{selectedPool.currentTick}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
