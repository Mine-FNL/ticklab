/**
 * Alert System Module
 * 
 * Monitors LP positions and triggers alerts based on configurable conditions.
 * Supports price proximity alerts, out-of-range notifications, IL thresholds, and fee targets.
 */

import { ImportedPosition } from './wallet/positions';
import { PoolState } from '@/types';

// ============================================================================
// Types
// ============================================================================

export type AlertType = 
  | 'price_near_bound' 
  | 'out_of_range' 
  | 'il_threshold' 
  | 'fee_target'
  | 'price_target'
  | 'volatility_spike';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertConfig {
  id: string;
  type: AlertType;
  threshold: number;
  enabled: boolean;
  severity?: AlertSeverity;
  cooldownMinutes?: number;
  notificationChannels?: NotificationChannel[];
}

export type NotificationChannel = 
  | 'browser'
  | 'email'
  | 'webhook'
  | 'telegram'
  | 'discord';

export interface Alert {
  id: string;
  configId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: number;
  positionId?: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
}

export interface AlertHistory {
  alerts: Alert[];
  lastTriggered: Record<string, number>;
}

export interface PositionAlertState {
  positionId: string;
  lastPrice: number;
  lastTick: number;
  feesAccumulated: number;
  ilPercentage: number;
  alertsTriggered: string[];
}

// ============================================================================
// Alert Configuration Presets
// ============================================================================

export const ALERT_PRESETS: Record<AlertType, Partial<AlertConfig>> = {
  price_near_bound: {
    threshold: 0.05, // 5% of range
    severity: 'warning',
    cooldownMinutes: 60,
  },
  out_of_range: {
    threshold: 0,
    severity: 'critical',
    cooldownMinutes: 30,
  },
  il_threshold: {
    threshold: -0.05, // -5% IL
    severity: 'warning',
    cooldownMinutes: 120,
  },
  fee_target: {
    threshold: 100, // $100 in fees
    severity: 'info',
    cooldownMinutes: 1440, // Once per day
  },
  price_target: {
    threshold: 0,
    severity: 'info',
    cooldownMinutes: 60,
  },
  volatility_spike: {
    threshold: 0.1, // 10% price change
    severity: 'warning',
    cooldownMinutes: 30,
  },
};

// ============================================================================
// Alert Checking Functions
// ============================================================================

/**
 * Check if position is near price bounds
 * 
 * @param position - Position to check
 * @param poolState - Current pool state
 * @param threshold - Threshold as percentage of range (0-1)
 * @returns Whether alert should trigger
 */
export function checkPriceNearBound(
  position: ImportedPosition,
  poolState: PoolState,
  threshold: number
): boolean {
  const currentTick = poolState.tick;
  const rangeSize = position.tickUpper - position.tickLower;
  
  // Calculate distance to bounds as percentage of range
  const distanceToLower = (currentTick - position.tickLower) / rangeSize;
  const distanceToUpper = (position.tickUpper - currentTick) / rangeSize;
  
  // Alert if within threshold of either bound
  return distanceToLower < threshold || distanceToUpper < threshold;
}

/**
 * Check if position is out of range
 * 
 * @param position - Position to check
 * @param poolState - Current pool state
 * @returns Whether position is out of range
 */
export function checkOutOfRange(
  position: ImportedPosition,
  poolState: PoolState
): boolean {
  return (
    poolState.tick < position.tickLower || 
    poolState.tick > position.tickUpper
  );
}

/**
 * Check if impermanent loss exceeds threshold
 * 
 * @param position - Position to check
 * @param poolState - Current pool state
 * @param entryPrice - Entry price when position was created
 * @param threshold - IL threshold (negative number)
 * @returns Whether IL exceeds threshold
 */
export function checkILThreshold(
  position: ImportedPosition,
  poolState: PoolState,
  entryPrice: number,
  threshold: number
): boolean {
  // Calculate current price from sqrtPriceX96
  const sqrtPriceX96 = BigInt(poolState.sqrtPriceX96);
  const Q96 = BigInt(2) ** BigInt(96);
  const priceSquared = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
  
  const decimalDiff = position.pool.token1.decimals - position.pool.token0.decimals;
  const currentPrice = priceSquared * 10 ** decimalDiff;
  
  // Calculate IL for concentrated position
  const priceRatio = currentPrice / entryPrice;
  const il = calculateConcentratedIL(
    priceRatio,
    position.tickLower,
    position.tickUpper,
    entryPrice
  );
  
  return il <= threshold;
}

/**
 * Check if fee target is reached
 * 
 * @param position - Position to check
 * @param accumulatedFees - Total fees accumulated (in USD)
 * @param target - Fee target in USD
 * @returns Whether target is reached
 */
export function checkFeeTarget(
  position: ImportedPosition,
  accumulatedFees: number,
  target: number
): boolean {
  return accumulatedFees >= target;
}

/**
 * Check for price target hit
 * 
 * @param poolState - Current pool state
 * @param targetPrice - Target price
 * @param tolerance - Price tolerance percentage
 * @returns Whether price target is hit
 */
export function checkPriceTarget(
  poolState: PoolState,
  targetPrice: number,
  tolerance: number = 0.01
): boolean {
  const sqrtPriceX96 = BigInt(poolState.sqrtPriceX96);
  const Q96 = BigInt(2) ** BigInt(96);
  const currentPrice = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
  
  const priceDiff = Math.abs(currentPrice - targetPrice) / targetPrice;
  return priceDiff <= tolerance;
}

/**
 * Check for volatility spike
 * 
 * @param currentPrice - Current price
 * @param previousPrice - Previous price
 * @param threshold - Volatility threshold (0-1)
 * @returns Whether volatility exceeds threshold
 */
export function checkVolatilitySpike(
  currentPrice: number,
  previousPrice: number,
  threshold: number
): boolean {
  if (previousPrice === 0) return false;
  
  const priceChange = Math.abs(currentPrice - previousPrice) / previousPrice;
  return priceChange >= threshold;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate impermanent loss for concentrated liquidity position
 * 
 * @param priceRatio - Current price / Entry price
 * @param tickLower - Lower tick
 * @param tickUpper - Upper tick
 * @param entryPrice - Entry price
 * @returns IL as percentage
 */
function calculateConcentratedIL(
  priceRatio: number,
  tickLower: number,
  tickUpper: number,
  entryPrice: number
): number {
  const lowerPrice = 1.0001 ** tickLower;
  const upperPrice = 1.0001 ** tickUpper;
  const currentPrice = entryPrice * priceRatio;
  
  if (currentPrice <= lowerPrice) {
    // Below range
    const ratio = lowerPrice / entryPrice;
    return (2 * Math.sqrt(priceRatio / ratio) - 1 - priceRatio / ratio) * ratio;
  } else if (currentPrice >= upperPrice) {
    // Above range
    const ratio = upperPrice / entryPrice;
    return 2 * Math.sqrt(ratio / priceRatio) - 1 - ratio / priceRatio;
  } else {
    // In range - simplified calculation
    const sqrtP = Math.sqrt(currentPrice);
    const sqrtPL = Math.sqrt(lowerPrice);
    const sqrtPU = Math.sqrt(upperPrice);
    
    const L = sqrtPU - sqrtPL;
    const valueInPool = (sqrtP - sqrtPL) / L + (1 / sqrtP - 1 / sqrtPU) * currentPrice / L;
    const valueHodl = 0.5 + 0.5 * currentPrice / entryPrice;
    
    return (valueInPool - valueHodl) / valueHodl;
  }
}

// ============================================================================
// Alert Manager
// ============================================================================

export class AlertManager {
  private configs: Map<string, AlertConfig> = new Map();
  private history: AlertHistory = { alerts: [], lastTriggered: {} };
  private positionStates: Map<string, PositionAlertState> = new Map();

  /**
   * Add or update alert configuration
   */
  setConfig(config: AlertConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Remove alert configuration
   */
  removeConfig(configId: string): void {
    this.configs.delete(configId);
  }

  /**
   * Get all alert configurations
   */
  getConfigs(): AlertConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get configs for a specific alert type
   */
  getConfigsByType(type: AlertType): AlertConfig[] {
    return this.getConfigs().filter((c) => c.type === type);
  }

  /**
   * Check if alert can be triggered (respects cooldown)
   */
  private canTrigger(configId: string, cooldownMinutes: number = 60): boolean {
    const lastTriggered = this.history.lastTriggered[configId];
    if (!lastTriggered) return true;

    const cooldownMs = cooldownMinutes * 60 * 1000;
    return Date.now() - lastTriggered >= cooldownMs;
  }

  /**
   * Record alert trigger
   */
  private recordTrigger(configId: string): void {
    this.history.lastTriggered[configId] = Date.now();
  }

  /**
   * Check all alerts for a position
   */
  checkAlerts(
    position: ImportedPosition,
    poolState: PoolState,
    metadata?: {
      entryPrice?: number;
      accumulatedFees?: number;
      targetPrice?: number;
    }
  ): Alert[] {
    const triggeredAlerts: Alert[] = [];
    const positionId = position.id;

    // Get or create position state
    let posState = this.positionStates.get(positionId);
    if (!posState) {
      posState = {
        positionId,
        lastPrice: 0,
        lastTick: poolState.tick,
        feesAccumulated: 0,
        ilPercentage: 0,
        alertsTriggered: [],
      };
      this.positionStates.set(positionId, posState);
    }

    // Check each enabled config
    for (const config of this.configs.values()) {
      if (!config.enabled) continue;
      if (!this.canTrigger(config.id, config.cooldownMinutes)) continue;

      let triggered = false;
      let title = '';
      let message = '';
      let alertMetadata: Record<string, unknown> = {};

      switch (config.type) {
        case 'price_near_bound':
          triggered = checkPriceNearBound(position, poolState, config.threshold);
          if (triggered) {
            title = 'Price Near Range Bound';
            message = `Your ${position.pool.token0.symbol}/${position.pool.token1.symbol} position is approaching its price range boundary.`;
            alertMetadata = { currentTick: poolState.tick };
          }
          break;

        case 'out_of_range':
          triggered = checkOutOfRange(position, poolState);
          if (triggered) {
            title = 'Position Out of Range';
            message = `Your ${position.pool.token0.symbol}/${position.pool.token1.symbol} position is now out of range and not earning fees.`;
            alertMetadata = { currentTick: poolState.tick };
          }
          break;

        case 'il_threshold':
          if (metadata?.entryPrice) {
            triggered = checkILThreshold(
              position,
              poolState,
              metadata.entryPrice,
              config.threshold
            );
            if (triggered) {
              title = 'Impermanent Loss Alert';
              message = `Your position has experienced significant impermanent loss.`;
              alertMetadata = { ilPercentage: posState.ilPercentage };
            }
          }
          break;

        case 'fee_target':
          if (metadata?.accumulatedFees !== undefined) {
            triggered = checkFeeTarget(position, metadata.accumulatedFees, config.threshold);
            if (triggered) {
              title = 'Fee Target Reached';
              message = `Your position has accumulated $${metadata.accumulatedFees.toFixed(2)} in fees.`;
              alertMetadata = { feesAccumulated: metadata.accumulatedFees };
            }
          }
          break;

        case 'price_target':
          if (metadata?.targetPrice !== undefined) {
            triggered = checkPriceTarget(poolState, metadata.targetPrice);
            if (triggered) {
              title = 'Price Target Hit';
              message = `The pool price has reached your target of $${metadata.targetPrice}.`;
              alertMetadata = { targetPrice: metadata.targetPrice };
            }
          }
          break;

        case 'volatility_spike':
          const currentPrice = calculatePriceFromSqrtX96(poolState.sqrtPriceX96.toString());
          if (posState.lastPrice > 0) {
            triggered = checkVolatilitySpike(currentPrice, posState.lastPrice, config.threshold);
            if (triggered) {
              title = 'Volatility Spike Detected';
              message = 'Significant price movement detected in the pool.';
              alertMetadata = { priceChange: Math.abs(currentPrice - posState.lastPrice) / posState.lastPrice };
            }
          }
          posState.lastPrice = currentPrice;
          break;
      }

      if (triggered) {
        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          configId: config.id,
          type: config.type,
          severity: config.severity || 'info',
          title,
          message,
          timestamp: Date.now(),
          positionId,
          metadata: alertMetadata,
          acknowledged: false,
        };

        triggeredAlerts.push(alert);
        this.history.alerts.push(alert);
        this.recordTrigger(config.id);
        posState.alertsTriggered.push(alert.id);
      }
    }

    // Update position state
    posState.lastTick = poolState.tick;
    this.positionStates.set(positionId, posState);

    return triggeredAlerts;
  }

  /**
   * Get all alerts
   */
  getAlerts(includeAcknowledged: boolean = false): Alert[] {
    if (includeAcknowledged) {
      return this.history.alerts;
    }
    return this.history.alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Get alerts for a specific position
   */
  getAlertsForPosition(positionId: string): Alert[] {
    return this.history.alerts.filter(
      (a) => a.positionId === positionId && !a.acknowledged
    );
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.history.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Clear all acknowledged alerts
   */
  clearAcknowledgedAlerts(): void {
    this.history.alerts = this.history.alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Clear all alerts
   */
  clearAllAlerts(): void {
    this.history.alerts = [];
    this.history.lastTriggered = {};
  }

  /**
   * Export alert history
   */
  exportHistory(): AlertHistory {
    return { ...this.history };
  }

  /**
   * Import alert history
   */
  importHistory(history: AlertHistory): void {
    this.history = history;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculatePriceFromSqrtX96(sqrtPriceX96: string): number {
  const sqrtPrice = BigInt(sqrtPriceX96);
  const Q96 = BigInt(2) ** BigInt(96);
  return Number(sqrtPrice * sqrtPrice) / Number(Q96 * Q96);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let alertManagerInstance: AlertManager | null = null;

/**
 * Get the singleton alert manager instance
 */
export function getAlertManager(): AlertManager {
  if (!alertManagerInstance) {
    alertManagerInstance = new AlertManager();
  }
  return alertManagerInstance;
}

/**
 * Reset the alert manager (useful for testing)
 */
export function resetAlertManager(): void {
  alertManagerInstance = null;
}

// ============================================================================
// Simple Alert Check Utilities
// ============================================================================

export interface SimpleAlert {
  id: string
  type: 'price_below' | 'price_above' | 'out_of_range' | 'il_threshold' | 'fee_below'
  positionId?: string
  poolAddress: string
  threshold: number
  enabled: boolean
  triggered: boolean
  triggeredAt?: Date
  message: string
}

/**
 * Check alerts for a position and return triggered alerts
 */
export function checkAlerts(
  alerts: SimpleAlert[],
  currentPrice: number,
  currentTick: number,
  lowerTick: number,
  upperTick: number,
  ilPercent: number,
  feesEarned: number
): SimpleAlert[] {
  const now = new Date()

  return alerts
    .filter(alert => alert.enabled && !alert.triggered)
    .map(alert => {
      let shouldTrigger = false

      switch (alert.type) {
        case 'price_below':
          shouldTrigger = currentPrice <= alert.threshold
          break
        case 'price_above':
          shouldTrigger = currentPrice >= alert.threshold
          break
        case 'out_of_range':
          shouldTrigger = currentTick < lowerTick || currentTick > upperTick
          break
        case 'il_threshold':
          shouldTrigger = ilPercent >= alert.threshold
          break
        case 'fee_below':
          shouldTrigger = feesEarned < alert.threshold
          break
      }

      if (shouldTrigger) {
        return {
          ...alert,
          triggered: true,
          triggeredAt: now,
          message: generateAlertMessage(alert, { currentPrice, currentTick, ilPercent, feesEarned })
        }
      }

      return alert
    })
}

function generateAlertMessage(alert: SimpleAlert, data: {
  currentPrice: number
  currentTick: number
  ilPercent: number
  feesEarned: number
}): string {
  switch (alert.type) {
    case 'price_below':
      return `Price ${data.currentPrice.toFixed(2)} fell below your alert at ${alert.threshold}`
    case 'price_above':
      return `Price ${data.currentPrice.toFixed(2)} rose above your alert at ${alert.threshold}`
    case 'out_of_range':
      return `Position moved out of range at tick ${data.currentTick}`
    case 'il_threshold':
      return `IL reached ${data.ilPercent.toFixed(2)}%, exceeding threshold of ${alert.threshold}%`
    case 'fee_below':
      return `Fees earned ${data.feesEarned.toFixed(2)} below threshold of ${alert.threshold}`
    default:
      return `Alert triggered`
  }
}

// ============================================================================
// Browser Notifications
// ============================================================================

/**
 * Request permission for browser notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Show browser notification
 */
export function showNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  new Notification(title, {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    ...options,
  });
}

/**
 * Show alert notification
 */
export function showAlertNotification(alert: Alert): void {
  showNotification(alert.title, {
    body: alert.message,
    tag: alert.id,
    requireInteraction: alert.severity === 'critical',
    data: alert,
  });
}
