/**
 * MetricCard Component
 * 
 * Metric display card with optional change indicator.
 */

'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'highlight' | 'success' | 'warning' | 'danger';
  className?: string;
  loading?: boolean;
}

/**
 * Format number with specified decimals
 */
function formatValue(
  value: string | number,
  decimals: number,
  prefix: string = '',
  suffix: string = ''
): string {
  if (typeof value === 'string') return `${prefix}${value}${suffix}`;
  
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  return `${prefix}${formatted}${suffix}`;
}

/**
 * MetricCard - Metric display card
 * 
 * @example
 * ```tsx
 * <MetricCard 
 *   label="Total Value Locked"
 *   value={50000000}
 *   change={5.2}
 *   prefix="$"
 *   decimals={0}
 *   size="lg"
 * />
 * 
 * <MetricCard 
 *   label="APR"
 *   value={12.5}
 *   suffix="%"
 *   decimals={2}
 *   variant="success"
 * />
 * ```
 */
export function MetricCard({
  label,
  value,
  change,
  prefix = '',
  suffix = '',
  decimals = 2,
  size = 'md',
  variant = 'default',
  className,
  loading = false,
}: MetricCardProps) {
  // Size configurations
  const sizeClasses = {
    sm: {
      card: 'p-3',
      label: 'text-xs',
      value: 'text-lg',
      change: 'text-xs',
    },
    md: {
      card: 'p-4',
      label: 'text-sm',
      value: 'text-2xl',
      change: 'text-sm',
    },
    lg: {
      card: 'p-6',
      label: 'text-base',
      value: 'text-4xl',
      change: 'text-base',
    },
  };

  const classes = sizeClasses[size];

  // Variant configurations
  const variantClasses = {
    default: 'bg-zinc-900/50 border-zinc-800',
    highlight: 'bg-emerald-500/10 border-emerald-500/30',
    success: 'bg-emerald-500/10 border-emerald-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    danger: 'bg-rose-500/10 border-rose-500/30',
  };

  // Get change indicator
  const getChangeIndicator = () => {
    if (change === undefined || change === 0) {
      return <Minus className="w-3 h-3 text-zinc-500" />;
    }
    if (change > 0) {
      return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    }
    return <TrendingDown className="w-3 h-3 text-rose-400" />;
  };

  if (loading) {
    return (
      <Card className={cn(variantClasses[variant], className)}>
        <CardContent className={cn(classes.card, 'animate-pulse')}>
          <div className="h-4 bg-zinc-800 rounded w-1/2 mb-2" />
          <div className="h-8 bg-zinc-800 rounded w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(variantClasses[variant], className)}>
      <CardContent className={cn(classes.card)}>
        {/* Label */}
        <p className={cn('text-zinc-500 mb-1', classes.label)}>
          {label}
        </p>

        {/* Value and change */}
        <div className="flex items-end justify-between">
          <p className={cn(
            'font-bold text-zinc-100',
            classes.value
          )}>
            {formatValue(value, decimals, prefix, suffix)}
          </p>

          {change !== undefined && (
            <div className={cn(
              'flex items-center gap-1',
              classes.change
            )}>
              {getChangeIndicator()}
              <span className={cn(
                'font-medium',
                change > 0 ? 'text-emerald-400' :
                change < 0 ? 'text-rose-400' :
                'text-zinc-500'
              )}>
                {change > 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MetricGroup - Group of metric cards
 */
export function MetricGroup({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
}) {
  const columnClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={cn('grid gap-4', columnClasses[columns], className)}>
      {children}
    </div>
  );
}

export default MetricCard;
