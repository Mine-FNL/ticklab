/**
 * Tooltip Component
 * 
 * Custom tooltip component for additional information.
 */

'use client';

import React, { useState } from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  triggerClassName?: string;
  showIcon?: boolean;
  icon?: 'help' | 'info';
}

/**
 * Tooltip - Custom tooltip component
 * 
 * @example
 * ```tsx
 * <Tooltip content="This is helpful information">
 *   <span>Hover me</span>
 * </Tooltip>
 * 
 * <Tooltip 
 *   content="APR = Annual Percentage Rate" 
 *   showIcon 
 *   icon="help"
 * />
 * ```
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  className,
  triggerClassName,
  showIcon = false,
  icon = 'help',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-800',
  };

  const Icon = icon === 'help' ? HelpCircle : Info;

  if (showIcon) {
    return (
      <div className="relative inline-flex items-center">
        <div
          className={cn('relative', triggerClassName)}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          <Icon className="w-4 h-4 text-zinc-500 cursor-help hover:text-zinc-400 transition-colors" />
          
          {isVisible && (
            <div
              className={cn(
                'absolute z-50 w-64 p-3',
                'bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl',
                positionClasses[position],
                className
              )}
            >
              <div className="text-sm text-zinc-300">{content}</div>
              
              {/* Arrow */}
              <div
                className={cn(
                  'absolute w-0 h-0 border-4 border-transparent',
                  arrowClasses[position]
                )}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <div
        className={cn(triggerClassName)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 w-max max-w-xs p-3',
            'bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl',
            positionClasses[position],
            className
          )}
        >
          <div className="text-sm text-zinc-300">{content}</div>
          
          {/* Arrow */}
          <div
            className={cn(
              'absolute w-0 h-0 border-4 border-transparent',
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  );
}

/**
 * InfoTooltip - Simplified info tooltip with icon
 */
export function InfoTooltip({ 
  content, 
  className 
}: { 
  content: React.ReactNode; 
  className?: string 
}) {
  return (
    <Tooltip 
      content={content} 
      showIcon 
      icon="info"
      className={className}
    />
  );
}

/**
 * HelpTooltip - Simplified help tooltip with icon
 */
export function HelpTooltip({ 
  content, 
  className 
}: { 
  content: React.ReactNode; 
  className?: string 
}) {
  return (
    <Tooltip 
      content={content} 
      showIcon 
      icon="help"
      className={className}
    />
  );
}

export default Tooltip;
