/**
 * @ticklab/sdk — public API surface.
 *
 * Two import shapes are supported:
 *
 *   import { TicklabClient } from '@ticklab/sdk';
 *   const client = new TicklabClient({ baseUrl });
 *   const r = await client.backtests.run({ ... });
 *
 *   // Tree-shakeable: pull only the endpoint you need.
 *   import { backtestsRun, TicklabClient } from '@ticklab/sdk';
 *   const r = await backtestsRun(client, { ... });
 */

export {
  TicklabClient,
  backtestsRun,
  riskCompute,
  poolsDiscover,
  v4HooksDiscover,
  simulationsRun,
} from './client.js';

export {
  TicklabError,
  isTicklabError,
  classifyApiError,
  type TicklabErrorCode,
  type TicklabErrorOptions,
} from './errors.js';

export type {
  Address,
  Amount,
  BacktestResult,
  BacktestRunParams,
  BacktestRunResponse,
  BacktestWarning,
  ChecklistInput,
  ChecklistItem,
  ChecklistResult,
  ChecklistVerdict,
  ClientConfig,
  ConfidenceBands,
  DepositToken,
  DrawdownPoint,
  EquityPoint,
  FeeEstimate,
  HookBehavior,
  HookCategory,
  HookLPScore,
  Pool,
  PoolsDiscoverParams,
  PoolsDiscoverResponse,
  RebalanceMode,
  RequestOptions,
  RiskComputeParams,
  RiskReportResponse,
  SimulationScenarioPoint,
  SimulationType,
  SimulationsRunParams,
  SimulationsRunResponse,
  Token,
  V4Hook,
  V4HooksDiscoverParams,
  V4HooksDiscoverResponse,
  VolumeScenario,
  WarningSeverity,
  WithRequestIdHeader,
} from './types.js';