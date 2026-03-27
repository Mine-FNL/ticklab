/**
 * LoadingState Component
 * 
 * Loading skeleton/spinner for async states.
 */

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LoadingType = 'spinner' | 'skeleton';

export interface LoadingStateProps {
  type?: LoadingType;
  count?: number;
  className?: string;
  message?: string;
}

/**
 * LoadingState - Loading skeleton/spinner component
 * 
 * @example
 * ```tsx
 * <LoadingState type="skeleton" count={3} />
 * <LoadingState type="spinner" message="Loading pool data..." />
 * ```
 */
export function LoadingState({
  type = 'spinner',
  count = 3,
  className,
  message = 'Loading...',
}: LoadingStateProps) {
  if (type === 'spinner') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        {message && (
          <p className="mt-4 text-sm text-zinc-500">{message}</p>
        )}
      </div>
    );
  }

  // Skeleton loading
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl animate-pulse"
        >
          <div className="flex items-center gap-4">
            {/* Avatar skeleton */}
            <div className="w-10 h-10 rounded-full bg-zinc-800" />
            
            {/* Content skeleton */}
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-1/3" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
            
            {/* Action skeleton */}
            <div className="h-8 bg-zinc-800 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * CardSkeleton - Card-style skeleton loader
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl animate-pulse', className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-5 bg-zinc-800 rounded w-1/3" />
          <div className="h-5 bg-zinc-800 rounded w-16" />
        </div>
        
        {/* Content */}
        <div className="h-24 bg-zinc-800/50 rounded-lg" />
        
        {/* Footer */}
        <div className="flex gap-2">
          <div className="h-8 bg-zinc-800 rounded flex-1" />
          <div className="h-8 bg-zinc-800 rounded flex-1" />
          <div className="h-8 bg-zinc-800 rounded flex-1" />
        </div>
      </div>
    </div>
  );
}

/**
 * ChartSkeleton - Chart-style skeleton loader
 */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl animate-pulse', className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="h-5 bg-zinc-800 rounded w-1/4" />
        
        {/* Chart area */}
        <div className="h-64 bg-zinc-800/50 rounded-lg relative overflow-hidden">
          {/* Simulated chart lines */}
          <div className="absolute inset-0 flex items-end justify-around px-4 pb-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-4 bg-zinc-700 rounded-t"
                style={{ 
                  height: `${30 + Math.random() * 50}%`,
                  opacity: 0.3 + Math.random() * 0.4
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TableSkeleton - Table-style skeleton loader
 */
export function TableSkeleton({ 
  rows = 5, 
  columns = 4,
  className 
}: { 
  rows?: number; 
  columns?: number;
  className?: string 
}) {
  return (
    <div className={cn('bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="flex gap-4 p-4 bg-zinc-800/50 border-b border-zinc-800">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-zinc-800 rounded flex-1 animate-pulse" />
        ))}
      </div>
      
      {/* Rows */}
      <div className="divide-y divide-zinc-800">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 p-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div 
                key={colIndex} 
                className="h-4 bg-zinc-800/50 rounded flex-1 animate-pulse"
                style={{ animationDelay: `${(rowIndex * columns + colIndex) * 50}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LoadingState;
