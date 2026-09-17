/**
 * @univ3-strategy-lab/sdk — public API surface.
 *
 * Two import shapes are supported:
 *
 *   import { UnivariateClient } from '@univ3-strategy-lab/sdk';
 *   const client = new UnivariateClient({ baseUrl });
 *   const r = await client.backtests.run({ ... });
 *
 *   // Tree-shakeable: pull only the endpoint you need.
 *   import { backtestsRun, UnivariateClient } from '@univ3-strategy-lab/sdk';
 *   const r = await backtestsRun(client, { ... });
 */

export {
  UnivariateClient,
  backtestsRun,
  riskCompute,
  poolsDiscover,
  v4HooksDiscover,
  simulationsRun,
} from './client.js';

export {
  UnivariateError,
  isUnivariateError,
  classifyApiError,
  type UnivariateErrorCode,
  type UnivariateErrorOptions,
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