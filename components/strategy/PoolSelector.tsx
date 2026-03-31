/**
 * PoolSelector Component - Universal ERC20 Token Support
 * 
 * Users can input ANY valid ERC20 token address.
 * Token metadata is resolved on-chain via RPC.
 * Pool is discovered via Uniswap V3 Factory contract.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Search, Droplets, AlertCircle, RefreshCw, Check, X, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToken, useTokenValidation } from '@/hooks/useTokens';
import { usePoolDiscovery } from '@/hooks/usePools';
import { usePoolState } from '@/hooks/usePoolState';
import { FEE_TIER_LABELS, SUPPORTED_FEE_TIERS } from '@/lib/constants';
import { isValidAddress } from '@/lib/data/tokens';
import type { Pool } from '@/types';

export interface PoolSelectorProps {
  chainId: number;
  onPoolSelect: (pool: Pool | null) => void;
  selectedPool?: Pool | null;
  className?: string;
}

/**
 * TokenInput - Universal ERC20 token address input
 */
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
          {isResolving && (
            <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
          )}
          {resolvedToken && !isResolving && (
            <Check className="w-4 h-4 text-emerald-500" />
          )}
          {showResolve && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onResolve}
              className="h-6 px-2 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            >
              Resolve
            </Button>
          )}
        </div>
      </div>
      
      {/* Token Info */}
      {resolvedToken && (
        <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
            {resolvedToken.symbol.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-400 truncate">
              {resolvedToken.name}
            </p>
            <p className="text-xs text-emerald-400/70">
              {resolvedToken.symbol} • {resolvedToken.decimals} decimals
            </p>
          </div>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <p className="text-xs text-red-400">
          {error.message}
        </p>
      )}
      
      {/* Invalid Format Warning */}
      {value && !isValidFormat && !error && (
        <p className="text-xs text-amber-400">
          Invalid Ethereum address format
        </p>
      )}
    </div>
  );
}

/**
 * PoolSelector - Discover pools with any ERC20 tokens
 */
export function PoolSelector({
  chainId,
  onPoolSelect,
  selectedPool,
  className,
}: PoolSelectorProps) {
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [selectedFeeTier, setSelectedFeeTier] = useState<number | undefined>(undefined);
  const [manualResolveA, setManualResolveA] = useState(false);
  const [manualResolveB, setManualResolveB] = useState(false);

  // Resolve tokens via RPC
  const { 
    data: tokenAData, 
    isLoading: isResolvingA, 
    error: tokenAError,
    refetch: refetchTokenA 
  } = useToken(
    chainId,
    (manualResolveA || tokenA.length === 42) && isValidAddress(tokenA) ? tokenA : null
  );
  
  const { 
    data: tokenBData, 
    isLoading: isResolvingB, 
    error: tokenBError,
    refetch: refetchTokenB 
  } = useToken(
    chainId,
    (manualResolveB || tokenB.length === 42) && isValidAddress(tokenB) ? tokenB : null
  );

  // Discover pool via factory
  const {
    data: poolData,
    isLoading: isDiscovering,
    error: discoveryError,
    refetch: refetchPool,
  } = usePoolDiscovery(
    chainId,
    tokenAData?.address || null,
    tokenBData?.address || null,
    selectedFeeTier
  );

  // Fetch pool state for current price
  const { data: poolState, isLoading: isLoadingState } = usePoolState(
    chainId,
    poolData?.address || null
  );

  const handleResolveA = useCallback(() => {
    setManualResolveA(true);
    refetchTokenA();
  }, [refetchTokenA]);

  const handleResolveB = useCallback(() => {
    setManualResolveB(true);
    refetchTokenB();
  }, [refetchTokenB]);

  const handleDiscover = useCallback(async () => {
    // Ensure both tokens are resolved
    if (!tokenAData) {
      setManualResolveA(true);
      await refetchTokenA();
    }
    if (!tokenBData) {
      setManualResolveB(true);
      await refetchTokenB();
    }
    
    // Then discover pool
    const result = await refetchPool();
    if (result.data) {
      onPoolSelect(result.data);
    } else {
      onPoolSelect(null);
    }
  }, [tokenAData, tokenBData, refetchTokenA, refetchTokenB, refetchPool, onPoolSelect]);

  const handleClear = useCallback(() => {
    setTokenA('');
    setTokenB('');
    setManualResolveA(false);
    setManualResolveB(false);
    setSelectedFeeTier(undefined);
    onPoolSelect(null);
  }, [onPoolSelect]);

  const isValidInput = isValidAddress(tokenA) && 
                       isValidAddress(tokenB) && 
                       tokenA.toLowerCase() !== tokenB.toLowerCase();

  const currentPrice = poolState?.token1Price;

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">
              Select Tokens
            </h3>
            <p className="text-xs text-zinc-500">
              Enter any ERC20 token addresses
            </p>
          </div>
          {poolData && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-zinc-400">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Token A Input */}
        <TokenInput
          label="Token A Address"
          value={tokenA}
          onChange={(v) => {
            setTokenA(v);
            setManualResolveA(false);
          }}
          onResolve={handleResolveA}
          resolvedToken={tokenAData ?? null}
          isResolving={isResolvingA}
          error={tokenAError}
          disabled={!!poolData}
        />

        {/* Token B Input */}
        <TokenInput
          label="Token B Address"
          value={tokenB}
          onChange={(v) => {
            setTokenB(v);
            setManualResolveB(false);
          }}
          onResolve={handleResolveB}
          resolvedToken={tokenBData ?? null}
          isResolving={isResolvingB}
          error={tokenBError}
          disabled={!!poolData}
        />

        {/* Fee Tier Selection */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Fee Tier (optional)</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedFeeTier(undefined)}
              disabled={!!poolData}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                selectedFeeTier === undefined
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
              )}
            >
              Auto-detect
            </button>
            {SUPPORTED_FEE_TIERS.map((fee) => (
              <button
                key={fee}
                onClick={() => setSelectedFeeTier(fee)}
                disabled={!!poolData}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  selectedFeeTier === fee
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                )}
              >
                {FEE_TIER_LABELS[fee]}
              </button>
            ))}
          </div>
        </div>

        {/* Discover Button */}
        {!poolData && (
          <Button
            onClick={handleDiscover}
            disabled={!isValidInput || isDiscovering || isResolvingA || isResolvingB}
            className={cn(
              'w-full',
              isValidInput && !isDiscovering && !isResolvingA && !isResolvingB
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            )}
          >
            {isResolvingA || isResolvingB ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Resolving Tokens...
              </>
            ) : isDiscovering ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Querying Factory...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Find Pool
              </>
            )}
          </Button>
        )}

        {/* Error State */}
        {discoveryError && !isDiscovering && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-400 font-medium">
                  Failed to find pool
                </p>
                <p className="text-xs text-red-400/70 mt-1">
                  {discoveryError instanceof Error 
                    ? discoveryError.message 
                    : 'Unknown error occurred'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchPool()}
                  className="mt-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* No Pool Found State */}
        {poolData === null && !isDiscovering && !discoveryError && isValidInput && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Droplets className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-400 font-medium">
                  No pool found
                </p>
                <p className="text-xs text-amber-400/70 mt-1">
                  No Uniswap V3 pool exists for {tokenAData?.symbol || 'Token A'} / {tokenBData?.symbol || 'Token B'}
                  {selectedFeeTier ? ` with ${FEE_TIER_LABELS[selectedFeeTier]} fee tier` : ' with any fee tier'}.
                </p>
                <a
                  href={`https://app.uniswap.org/#/add/${tokenA}/${tokenB}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Create pool on Uniswap
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Pool Found State */}
        {poolData && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-4">
            {/* Pool Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center border-2 border-zinc-800 text-white text-sm font-bold">
                    {poolData.token0.symbol.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-2 border-zinc-800 text-white text-sm font-bold">
                    {poolData.token1.symbol.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-zinc-100">
                    {poolData.token0.symbol} / {poolData.token1.symbol}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {poolData.address.slice(0, 6)}...{poolData.address.slice(-4)}
                  </p>
                </div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                {FEE_TIER_LABELS[poolData.feeTier]}
              </Badge>
            </div>

            {/* Current Price */}
            <div className="pt-3 border-t border-zinc-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">Current Price</span>
                {isLoadingState ? (
                  <Skeleton className="h-5 w-24 bg-zinc-800" />
                ) : currentPrice ? (
                  <span className="text-lg font-semibold text-emerald-400">
                    {currentPrice.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-sm text-amber-400">Unavailable</span>
                )}
              </div>
              {currentPrice && (
                <p className="text-xs text-zinc-500">
                  {poolData.token1.symbol} per {poolData.token0.symbol}
                </p>
              )}
            </div>

            {/* Pool Metrics */}
            {(poolData.tvlUSD !== undefined || poolData.apr !== undefined || poolData.volumeUSD24h !== undefined) && (
              <div className="pt-3 border-t border-zinc-800/50 grid grid-cols-3 gap-3">
                {poolData.tvlUSD !== undefined && (
                  <div className="text-center">
                    <p className="text-xs text-zinc-500">TVL</p>
                    <p className="text-sm font-medium text-zinc-300">
                      ${poolData.tvlUSD >= 1e6 
                        ? `${(poolData.tvlUSD / 1e6).toFixed(2)}M` 
                        : poolData.tvlUSD >= 1e3 
                          ? `${(poolData.tvlUSD / 1e3).toFixed(2)}K`
                          : poolData.tvlUSD.toFixed(2)}
                    </p>
                  </div>
                )}
                {poolData.volumeUSD24h !== undefined && (
                  <div className="text-center">
                    <p className="text-xs text-zinc-500">24h Vol</p>
                    <p className="text-sm font-medium text-zinc-300">
                      ${poolData.volumeUSD24h >= 1e6 
                        ? `${(poolData.volumeUSD24h / 1e6).toFixed(2)}M` 
                        : poolData.volumeUSD24h >= 1e3 
                          ? `${(poolData.volumeUSD24h / 1e3).toFixed(2)}K`
                          : poolData.volumeUSD24h.toFixed(2)}
                    </p>
                  </div>
                )}
                {poolData.apr !== undefined && (
                  <div className="text-center">
                    <p className="text-xs text-zinc-500">APR</p>
                    <p className="text-sm font-medium text-emerald-400">
                      {(poolData.apr * 100).toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* View on Explorer */}
            <div className="pt-3 border-t border-zinc-800/50">
              <a
                href={`https://etherscan.io/address/${poolData.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-300"
              >
                View pool on explorer
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PoolSelector;
