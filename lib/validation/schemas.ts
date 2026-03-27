/**
 * Validation Schemas
 * 
 * This module contains Zod validation schemas for all API inputs.
 */

import { z } from 'zod';

// Helper for Ethereum addresses
const ethereumAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
  message: 'Invalid Ethereum address format',
});

// Helper for positive integers
const positiveInt = z.number().int().positive();

// Helper for non-negative numbers
const nonNegative = z.number().nonnegative();

// Chain ID schema
export const chainIdSchema = z.number().int().positive();

// Token address schema
export const tokenAddressSchema = z.object({
  address: ethereumAddress,
  chainId: chainIdSchema,
});

// Token resolution request schema
export const tokenResolutionRequestSchema = z.object({
  address: ethereumAddress,
  chainId: chainIdSchema.default(1),
});

// Pool discovery request schema
export const poolDiscoveryRequestSchema = z.object({
  token: ethereumAddress.optional(),
  token0: ethereumAddress.optional(),
  token1: ethereumAddress.optional(),
  chainId: chainIdSchema.default(1),
});

// Pool details request schema
export const poolDetailsRequestSchema = z.object({
  address: ethereumAddress,
  chainId: chainIdSchema.default(1),
});

// Deposit token enum
const depositTokenEnum = z.enum(['token0', 'token1', 'usd']);

// Rebalance mode enum
const rebalanceModeEnum = z.enum(['none', 'periodic', 'threshold', 'volatility']);

// Volume scenario enum
const volumeScenarioEnum = z.enum(['low', 'base', 'high', 'custom']);

// Simulation request schema
export const simulationRequestSchema = z.object({
  poolAddress: ethereumAddress,
  chainId: chainIdSchema.default(1),
  depositAmount: z.string().min(1),
  depositToken: depositTokenEnum,
  lowerTick: z.number().int(),
  upperTick: z.number().int(),
  type: z.enum(['deterministic', 'monte_carlo']),
  horizonDays: positiveInt.max(365).default(30),
  priceScenario: z.object({
    type: z.enum(['static', 'drift', 'monte_carlo']),
    drift: z.number().optional(),
    volatility: z.number().optional(),
  }).optional(),
  volumeScenario: volumeScenarioEnum.default('base'),
  customVolumeMultiplier: z.number().positive().optional(),
  rebalanceMode: rebalanceModeEnum.default('none'),
  rebalanceParams: z.object({
    periodDays: positiveInt.optional(),
    priceThreshold: z.number().positive().optional(),
    volatilityThreshold: z.number().positive().optional(),
  }).optional(),
  gasCostGwei: nonNegative.default(20),
});

// Backtest request schema
export const backtestRequestSchema = z.object({
  poolAddress: ethereumAddress,
  chainId: chainIdSchema.default(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  depositAmount: z.string().min(1),
  depositToken: depositTokenEnum,
  lowerTick: z.number().int(),
  upperTick: z.number().int(),
  rebalanceMode: rebalanceModeEnum.default('none'),
  rebalanceParams: z.object({
    periodDays: positiveInt.optional(),
    priceThreshold: z.number().positive().optional(),
    volatilityThreshold: z.number().positive().optional(),
  }).optional(),
  gasCostGwei: nonNegative.default(20),
});

// Wallet positions request schema
export const walletPositionsRequestSchema = z.object({
  address: ethereumAddress,
  chainId: chainIdSchema.default(1),
});

// Position analytics request schema
export const positionAnalyticsRequestSchema = z.object({
  id: z.string(),
  chainId: chainIdSchema.default(1),
});

// Save strategy schema
export const saveStrategySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  poolAddress: ethereumAddress,
  chainId: chainIdSchema.default(1),
  depositAmount: z.string().min(1),
  depositToken: depositTokenEnum,
  lowerTick: z.number().int(),
  upperTick: z.number().int(),
  horizonDays: positiveInt.max(365).default(30),
  rebalanceMode: rebalanceModeEnum.default('none'),
  gasCostGwei: nonNegative.default(20),
  priceScenario: z.any().optional(),
  volumeScenario: z.any().optional(),
});

// Alert configuration schema
export const alertConfigSchema = z.object({
  type: z.enum(['price_near_bound', 'out_of_range', 'il_threshold', 'fee_target']),
  threshold: z.number().positive(),
  enabled: z.boolean().default(true),
});

// User settings schema
export const userSettingsSchema = z.object({
  defaultChainId: chainIdSchema.default(1),
  currency: z.string().default('USD'),
  chartTheme: z.enum(['light', 'dark']).default('dark'),
  decimalPlaces: z.number().int().min(0).max(10).default(4),
  defaultGasGwei: nonNegative.default(20),
  defaultHorizon: positiveInt.max(365).default(30),
});

// Price range schema
export const priceRangeSchema = z.object({
  min: z.number().positive(),
  max: z.number().positive(),
  steps: positiveInt.max(200).default(50),
});

// Monte Carlo params schema
export const monteCarloParamsSchema = z.object({
  initialPrice: z.number().positive(),
  drift: z.number().default(0),
  volatility: z.number().positive(),
  timeHorizon: positiveInt.default(30),
  numSimulations: positiveInt.max(10000).default(1000),
  meanReversion: z.object({
    enabled: z.boolean(),
    speed: z.number().positive(),
    longTermMean: z.number().positive(),
  }).optional(),
  jumpDiffusion: z.object({
    enabled: z.boolean(),
    jumpIntensity: z.number().positive(),
    jumpSizeMean: z.number(),
    jumpSizeStd: z.number().positive(),
  }).optional(),
});

// Range input schema
export const rangeInputSchema = z.object({
  lowerPrice: z.number().positive(),
  upperPrice: z.number().positive(),
}).refine((data) => data.lowerPrice < data.upperPrice, {
  message: 'Lower price must be less than upper price',
  path: ['lowerPrice'],
});

// Tick range schema
export const tickRangeSchema = z.object({
  lowerTick: z.number().int(),
  upperTick: z.number().int(),
}).refine((data) => data.lowerTick < data.upperTick, {
  message: 'Lower tick must be less than upper tick',
  path: ['lowerTick'],
});

// Historical data request schema
export const historicalDataRequestSchema = z.object({
  poolAddress: ethereumAddress,
  chainId: chainIdSchema.default(1),
  startTime: positiveInt,
  endTime: positiveInt,
}).refine((data) => data.startTime < data.endTime, {
  message: 'Start time must be before end time',
  path: ['startTime'],
});

// Export request schema
export const exportRequestSchema = z.object({
  type: z.enum(['csv', 'json', 'pdf']),
  strategyId: z.string().optional(),
  simulationId: z.string().optional(),
  backtestId: z.string().optional(),
});

// Share strategy schema
export const shareStrategySchema = z.object({
  chainId: chainIdSchema,
  pool: ethereumAddress,
  lower: z.number().int(),
  upper: z.number().int(),
  amount: z.string(),
  token: depositTokenEnum,
  horizon: positiveInt,
  rebalance: rebalanceModeEnum,
  gas: nonNegative,
});

// Type exports
export type TokenAddressInput = z.infer<typeof tokenAddressSchema>;
export type SimulationRequestInput = z.infer<typeof simulationRequestSchema>;
export type BacktestRequestInput = z.infer<typeof backtestRequestSchema>;
export type SaveStrategyInput = z.infer<typeof saveStrategySchema>;
export type AlertConfigInput = z.infer<typeof alertConfigSchema>;
export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
export type MonteCarloParamsInput = z.infer<typeof monteCarloParamsSchema>;
export type RangeInput = z.infer<typeof rangeInputSchema>;
export type ExportRequestInput = z.infer<typeof exportRequestSchema>;
