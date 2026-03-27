/**
 * DepositInput Component
 * 
 * Deposit amount input with token selection and USD estimation.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Wallet, DollarSign, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DepositInputProps {
  amount: string;
  token: 'token0' | 'token1' | 'usd';
  token0Symbol: string;
  token1Symbol: string;
  token0Price?: number;
  token1Price?: number;
  token0Balance?: string;
  token1Balance?: string;
  onAmountChange: (amount: string) => void;
  onTokenChange: (token: 'token0' | 'token1' | 'usd') => void;
  className?: string;
}

/**
 * DepositInput - Deposit amount input with token selection
 * 
 * @example
 * ```tsx
 * <DepositInput 
 *   amount="1000"
 *   token="usd"
 *   token0Symbol="ETH"
 *   token1Symbol="USDC"
 *   token0Price={1800}
 *   token1Price={1}
 *   onAmountChange={(amount) => setAmount(amount)}
 *   onTokenChange={(token) => setToken(token)}
 * />
 * ```
 */
export function DepositInput({
  amount,
  token,
  token0Symbol,
  token1Symbol,
  token0Price = 0,
  token1Price = 0,
  token0Balance = '0',
  token1Balance = '0',
  onAmountChange,
  onTokenChange,
  className,
}: DepositInputProps) {
  const [isTokenMenuOpen, setIsTokenMenuOpen] = useState(false);

  // Calculate USD value
  const usdValue = useMemo(() => {
    const numAmount = parseFloat(amount) || 0;
    switch (token) {
      case 'token0':
        return numAmount * token0Price;
      case 'token1':
        return numAmount * token1Price;
      case 'usd':
      default:
        return numAmount;
    }
  }, [amount, token, token0Price, token1Price]);

  // Token options
  const tokenOptions = [
    { value: 'usd' as const, label: 'USD', symbol: '$', icon: DollarSign },
    { value: 'token0' as const, label: token0Symbol, symbol: token0Symbol.slice(0, 2), icon: Wallet },
    { value: 'token1' as const, label: token1Symbol, symbol: token1Symbol.slice(0, 2), icon: Wallet },
  ];

  const selectedOption = tokenOptions.find(t => t.value === token);

  // Set max balance
  const setMaxBalance = () => {
    switch (token) {
      case 'token0':
        onAmountChange(token0Balance);
        break;
      case 'token1':
        onAmountChange(token1Balance);
        break;
      case 'usd':
        onAmountChange((parseFloat(token0Balance) * token0Price).toString());
        break;
    }
  };

  return (
    <Card className={cn('bg-zinc-900/50 border-zinc-800', className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-100">
            Deposit Amount
          </h3>
          <button
            onClick={setMaxBalance}
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Max
          </button>
        </div>

        {/* Amount input */}
        <div className="relative mb-4">
          <Input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="h-20 text-3xl font-bold bg-zinc-950 border-zinc-800 text-zinc-100 
                       placeholder:text-zinc-700 pr-32"
          />
          
          {/* Token selector */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="relative">
              <button
                onClick={() => setIsTokenMenuOpen(!isTokenMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg 
                           hover:bg-zinc-700 transition-colors"
              >
                <span className="font-medium text-zinc-200">
                  {selectedOption?.label}
                </span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-zinc-500 transition-transform',
                  isTokenMenuOpen && 'rotate-180'
                )} />
              </button>

              {/* Dropdown menu */}
              {isTokenMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10"
                    onClick={() => setIsTokenMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-40 bg-zinc-900 border border-zinc-800 
                                  rounded-xl shadow-xl z-20 overflow-hidden">
                    {tokenOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => {
                            onTokenChange(option.value);
                            setIsTokenMenuOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                            token === option.value
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'text-zinc-300 hover:bg-zinc-800'
                          )}
                        >
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* USD value */}
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-zinc-500">≈ {usdValue.toLocaleString(undefined, { 
            style: 'currency', 
            currency: 'USD',
            maximumFractionDigits: 2 
          })}</span>
          <span className="text-zinc-500">
            Balance: {token === 'token0' ? parseFloat(token0Balance).toFixed(4) : 
                      token === 'token1' ? parseFloat(token1Balance).toFixed(4) : 
                      '$' + (parseFloat(token0Balance) * token0Price).toFixed(2)}
          </span>
        </div>

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-2">
          {[25, 50, 75, 100].map((percent) => (
            <Button
              key={percent}
              variant="outline"
              onClick={() => {
                let maxAmount = 0;
                switch (token) {
                  case 'token0':
                    maxAmount = parseFloat(token0Balance);
                    break;
                  case 'token1':
                    maxAmount = parseFloat(token1Balance);
                    break;
                  case 'usd':
                    maxAmount = parseFloat(token0Balance) * token0Price;
                    break;
                }
                onAmountChange((maxAmount * percent / 100).toString());
              }}
              className="h-10 bg-zinc-800/50 border-zinc-800 text-zinc-400 
                         hover:bg-zinc-800 hover:text-zinc-200"
            >
              {percent}%
            </Button>
          ))}
        </div>

        {/* Token breakdown preview */}
        {usdValue > 0 && (
          <div className="mt-4 p-4 bg-zinc-800/50 rounded-xl">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Estimated Deposit
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                    {token0Symbol.slice(0, 2)}
                  </div>
                  <span className="text-sm text-zinc-400">{token0Symbol}</span>
                </div>
                <span className="text-sm font-medium text-zinc-200">
                  {(usdValue / 2 / token0Price).toFixed(6)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                    {token1Symbol.slice(0, 2)}
                  </div>
                  <span className="text-sm text-zinc-400">{token1Symbol}</span>
                </div>
                <span className="text-sm font-medium text-zinc-200">
                  {(usdValue / 2 / token1Price).toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DepositInput;
