/**
 * DataWarning Component
 * 
 * Data quality warning banner for displaying alerts and notifications.
 */

'use client';

import React, { useState } from 'react';
import { AlertTriangle, Info, XCircle, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataWarning {
  type: 'info' | 'warning' | 'error';
  message: string;
  source?: string;
  timestamp?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface DataWarningProps {
  warnings: DataWarning[];
  className?: string;
  onDismiss?: (index: number) => void;
}

/**
 * DataWarning - Data quality warning banner
 * 
 * @example
 * ```tsx
 * <DataWarning 
 *   warnings={[
 *     { type: 'warning', message: 'Data may be delayed', source: 'Subgraph' },
 *     { type: 'info', message: 'Using cached data' },
 *   ]}
 *   onDismiss={(index) => dismissWarning(index)}
 * />
 * ```
 */
export function DataWarning({
  warnings,
  className,
  onDismiss,
}: DataWarningProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const handleDismiss = (index: number) => {
    setDismissed(prev => new Set(prev).add(index));
    onDismiss?.(index);
  };

  // Filter out dismissed warnings
  const visibleWarnings = warnings.filter((_, index) => !dismissed.has(index));

  if (visibleWarnings.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {visibleWarnings.map((warning, index) => {
        const originalIndex = warnings.indexOf(warning);
        
        const config = {
          info: {
            icon: Info,
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/30',
            textColor: 'text-blue-400',
            iconColor: 'text-blue-400',
          },
          warning: {
            icon: AlertTriangle,
            bgColor: 'bg-amber-500/10',
            borderColor: 'border-amber-500/30',
            textColor: 'text-amber-400',
            iconColor: 'text-amber-400',
          },
          error: {
            icon: XCircle,
            bgColor: 'bg-rose-500/10',
            borderColor: 'border-rose-500/30',
            textColor: 'text-rose-400',
            iconColor: 'text-rose-400',
          },
        }[warning.type];

        const Icon = config.icon;

        return (
          <div
            key={originalIndex}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border transition-all',
              config.bgColor,
              config.borderColor
            )}
          >
            <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', config.iconColor)} />
            
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm', config.textColor)}>
                {warning.message}
              </p>
              
              {(warning.source || warning.timestamp) && (
                <div className="flex items-center gap-2 mt-1">
                  {warning.source && (
                    <span className="text-xs text-zinc-500">
                      Source: {warning.source}
                    </span>
                  )}
                  {warning.timestamp && (
                    <span className="text-xs text-zinc-600">
                      {new Date(warning.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
              
              {warning.action && (
                <button
                  onClick={warning.action.onClick}
                  className={cn(
                    'flex items-center gap-1 mt-2 text-xs font-medium',
                    'hover:underline',
                    config.textColor
                  )}
                >
                  {warning.action.label}
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {onDismiss && (
              <button
                onClick={() => handleDismiss(originalIndex)}
                className="p-1 rounded hover:bg-zinc-800/50 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DataWarning;
