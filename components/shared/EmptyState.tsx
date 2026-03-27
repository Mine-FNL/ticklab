/**
 * EmptyState Component
 * 
 * Empty state illustration with optional action button.
 */

'use client';

import React from 'react';
import { Search, Wallet, BarChart3, Droplets, FolderOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: 'search' | 'wallet' | 'chart' | 'pool' | 'folder';
  action?: EmptyStateAction;
  className?: string;
}

const iconMap = {
  search: Search,
  wallet: Wallet,
  chart: BarChart3,
  pool: Droplets,
  folder: FolderOpen,
};

/**
 * EmptyState - Empty state illustration component
 * 
 * @example
 * ```tsx
 * <EmptyState 
 *   title="No positions found"
 *   description="You don't have any active LP positions."
 *   icon="wallet"
 *   action={{ label: 'Create Position', onClick: () => navigate('/strategy') }}
 * />
 * ```
 */
export function EmptyState({
  title,
  description,
  icon = 'folder',
  action,
  className,
}: EmptyStateProps) {
  const Icon = iconMap[icon];

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4',
      'text-center',
      className
    )}>
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-zinc-600" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-zinc-200 mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        {description}
      </p>

      {/* Action button */}
      {action && (
        <Button
          onClick={action.onClick}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {action.label}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );
}

/**
 * EmptyStateCard - Empty state in a card wrapper
 */
export function EmptyStateCard({
  title,
  description,
  icon = 'folder',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      'bg-zinc-900/50 border border-zinc-800 rounded-xl',
      className
    )}>
      <EmptyState
        title={title}
        description={description}
        icon={icon}
        action={action}
      />
    </div>
  );
}

export default EmptyState;
