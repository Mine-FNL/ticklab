/**
 * Public TypeScript types for @ticklab/sdk.
 *
 * These mirror the upstream API contracts in lib/validation/schemas.ts,
 * lib/analytics/risk-types.ts, lib/simulation/backtest.ts, and
 * app/api/{backtests,risk,pools,v4}/route.ts. They are intentionally
 * self-contained (no @/ aliases, no zod) so the SDK compiles and ships
 * without dragging in the Next.js app code.
 *
 * Anything not exposed here is an SDK implementation detail and may
 * change between minor versions.
 */

/* -------------------------------------------------------------------------- */
/* Shared building blocks                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 0x-prefixed 40-character Ethereum address. Re-declared (instead of
 * referenced from the upstream `ethereumAddress` zod helper) so we stay
 * dependency-free.
 */
export type Address = string;

/**
 * Any standard ABI-shaped token amount. Strings are used for very large
 * wei-scaled integers; numbers for USD decimals.
 */
export type Amount = string | number;

/**
 * Common union used in enum-like fields across endpoints.
 */
export type DepositToken = 'token0' | 'token1' | 'usd';
export type RebalanceMode = 'none' | 'periodic' | 'threshold' | 'volatility';
export type VolumeScenario = 'low' | 'base' | 'high' | 'custom';
export type SimulationType = 'deterministic' | 'monte_carlo';

/**
 * Optional cancellation signal propagated to every fetch call.
 */
export interface RequestOptions {
  /**
   * An `AbortSignal` that cancels the in-flight request and any pending
   * retry sleeps. Use `AbortController` to wire this from the caller.
   */
  signal?: AbortSignal;
  /**
   * Per-call retry override. Falls back to the client default (3).
   * Set to 0 to disable retries for a specific call.
   */
  maxRetries?: number;
  /**
   * Per-call backoff override (ms). Falls back to the client default.
   */
  baseBackoffMs?: number;
}

/**
 * Headers attached to every result for tracing.
 */
export interface WithRequestIdHeader {
  /**
   * The `x-request-id` value either echoed in the response body or read
   * from the `x-request-id` response header. Always defined for successful
   * responses; `null` only when the request never reached the server
   * (in which case the SDK throws a `network` or `aborted` error).
   */
  requestId: string;
}

/* -------------------------------------------------------------------------- */
/* Tokens & pools                                                              */
/* -------------------------------------------------------------------------- */

export interface Token {
  chainId: number;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  verified?: boolean;
}

export interface Pool {
  chainId: number;
  address: Address;
  token0: Token;
  token1: Token;
  feeTier: number;
  tickSpacing: number;
  currentTick?: number;
  currentSqrtPriceX96?: string;
  currentLiquidity?: string;
  tvlUSD?: number;
  volumeUSD24h?: number;
  feesUSD24h?: number;
  apr?: number;
}

/* -------------------------------------------------------------------------- */
/* Backtests                                                                   */
/* -------------------------------------------------------------------------- */

/** Caller-facing input to {@link TicklabClient.backtests.run}. */
export interface BacktestRunParams {
  chainId?: number;
  poolAddress: Address;
  /** Lower bound expressed as a price (token1/token0). Internally converted to ticks. */
  lowerPrice: number;
  /** Upper bound expressed as a price (token1/token0). Internally converted to ticks. */
  upperPrice: number;
  depositAmount: Amount;
  depositToken: DepositToken;
  rebalanceMode?: RebalanceMode;
  rebalanceParams?: {
    periodDays?: number;
    priceThreshold?: number;
    volatilityThreshold?: number;
  };
  gasCostGwei?: number;
  /** Pool fee tier (e.g., 500, 3000, 10000). Required for the real-data path. */
  feeTier?: number;
  token0Decimals?: number;
  token1Decimals?: number;
  /** Set true to use the real-data path (DeFi Llama + CoinGecko). May return 502. */
  useRealData?: boolean;
  /** Window for the backtest, in days. Defaults to 30. */
  days?: number;
  /** Attach a 90% confidence band to the response. */
  includeConfidence?: boolean;
  confidenceWindowDays?: number;
  checklistInput?: ChecklistInput;
}

/** Confidence band block attached when `includeConfidence` is true. */
export interface ConfidenceBands {
  p05: number[];
  p50: number[];
  p95: number[];
  sampleSize: number;
  windowDays: number;
}

export type WarningSeverity = 'info' | 'warning' | 'error';
export interface BacktestWarning {
  type: string;
  severity: WarningSeverity;
  message: string;
  recommendation?: string;
}

/** Equity curve point — `lpValue` is the mark-to-market USD value of the LP position. */
export interface EquityPoint {
  timestamp: number;
  lpValue: number;
  hodlValue: number;
  fees: number;
}

/** Drawdown sample. */
export interface DrawdownPoint {
  timestamp: number;
  drawdown: number;
}

/** Core backtest result, returned as `results` on the response. */
export interface BacktestResult {
  totalReturn: number;
  hodlReturn: number;
  excessReturn: number;
  totalFees: number;
  realizedIL: number;
  gasCosts: number;
  rebalanceCount: number;
  timeInRange: number;
  periodsOutOfRange: number;
  equityCurve: EquityPoint[];
  drawdowns: DrawdownPoint[];
  bestWindow: { start: number; end: number; return: number };
  worstWindow: { start: number; end: number; return: number };
}

/** Full response shape from `POST /api/backtests`. */
export interface BacktestRunResponse extends WithRequestIdHeader {
  backtestId: string;
  useRealData: boolean;
  results: BacktestResult;
  dataSource?: string;
  dataPointsUsed?: number;
  fetchTimestamp?: string;
  warnings: BacktestWarning[];
  confidenceBands?: ConfidenceBands;
  checklist?: ChecklistResult;
}

/* -------------------------------------------------------------------------- */
/* Risk                                                                        */
/* -------------------------------------------------------------------------- */

export interface RiskComputeParams {
  /** ≥ 2 points required. */
  equityCurve: Array<{ timestamp: number; lpValue: number }>;
  /** Annual risk-free rate. Default 0. */
  riskFreeRate?: number;
  /** Default 252 (trading days). Use 365 for crypto. */
  annualizationFactor?: number;
}

/**
 * Output of {@link TicklabClient.risk.compute}. Mirrors the upstream
 * `RiskReport` interface (lib/analytics/risk-types.ts) with `requestId`
 * attached for tracing.
 */
export interface RiskReportResponse extends WithRequestIdHeader {
  totalReturn: number;
  annualizedReturn: number | null;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  valueAtRisk95: number;
  valueAtRisk99: number;
  conditionalVaR95: number;
  conditionalVaR99: number;
  ulcerIndex: number;
  burkeRatio: number;
  sampleSize: number;
  annualizationFactor: number;
  riskFreeRate: number;
}

/* -------------------------------------------------------------------------- */
/* Pool discovery                                                              */
/* -------------------------------------------------------------------------- */

export interface PoolsDiscoverParams {
  chainId?: number;
  /** Filter by token (0x…). */
  token?: Address;
  /** Search by symbol/name. */
  search?: string;
  /** Max results. Default 20, max 50. */
  limit?: number;
}

export interface PoolsDiscoverResponse extends WithRequestIdHeader {
  pools: Pool[];
  count: number;
  chainId: number;
  sortOptions: string[];
}

/* -------------------------------------------------------------------------- */
/* V4 hooks                                                                    */
/* -------------------------------------------------------------------------- */

export type HookCategory =
  | 'fee'
  | 'liquidity'
  | 'flow'
  | 'yield'
  | 'risk'
  | 'access'
  | 'custom';

export interface HookBehavior {
  feeAdjustment: 'none' | 'dynamic' | 'override' | 'share' | 'rebate';
  baseFeeBips?: number;
  additionalFeeBips?: number;
  hookShareBips?: number;
  gasOverheadPerSwap: number;
  flowMultiplier: number;
  minPositionValueUSD?: number;
  lockupPeriodDays?: number;
  requiresStaking?: boolean;
  stakingToken?: string;
  takesFromInput?: boolean;
  givesToOutput?: boolean;
  auditStatus: 'audited' | 'partial' | 'unaudited' | 'experimental';
  tvlInHookUSD?: number;
  description: string;
  lpImpact: string;
}

export interface HookLPScore {
  score: number;
  factors: Record<string, number>;
  rationale?: string;
}

export interface V4Hook {
  hookId: string;
  name: string;
  category: HookCategory;
  chains: number[];
  address: Address;
  behaviors: HookBehavior;
  score?: HookLPScore;
}

export interface V4HooksDiscoverParams {
  chainId?: number;
  category?: HookCategory;
  auditedOnly?: boolean;
  baseAPR?: number;
  volatility?: number;
}

export interface V4HooksDiscoverResponse extends WithRequestIdHeader {
  hooks: V4Hook[];
  count: number;
}

/* -------------------------------------------------------------------------- */
/* Simulations                                                                 */
/* -------------------------------------------------------------------------- */

export interface SimulationsRunParams {
  chainId?: number;
  poolAddress: Address;
  depositAmount: Amount;
  depositToken: DepositToken;
  lowerPrice: number;
  upperPrice: number;
  type?: SimulationType;
  horizonDays?: number;
  priceScenario?: {
    type: 'static' | 'drift' | 'monte_carlo';
    drift?: number;
    volatility?: number;
  };
  volumeScenario?: VolumeScenario;
  customVolumeMultiplier?: number;
  rebalanceMode?: RebalanceMode;
  rebalanceParams?: {
    periodDays?: number;
    priceThreshold?: number;
    volatilityThreshold?: number;
  };
  gasCostGwei?: number;
  feeTier?: number;
  token0Decimals?: number;
  token1Decimals?: number;
}

export interface FeeEstimate {
  feesUSD: number;
  dailyFeesUSD: number;
  totalFeesUSD: number;
  feeAPR: number;
  confidenceInterval: [number, number];
  assumptions: {
    dailyVolumeUSD: number;
    timeInRange: number;
    liquidityShare: number;
  };
}

export interface SimulationScenarioPoint {
  price: number;
  token0Amount: number;
  token1Amount: number;
  lpValue: number;
  hodlValue: number;
  inRange: boolean;
  feesAccrued: number;
  il: number;
}

export interface SimulationsRunResponse extends WithRequestIdHeader {
  simulationId: string;
  scenarios: SimulationScenarioPoint[];
  feeEstimate: FeeEstimate;
  warnings: BacktestWarning[];
}

/* -------------------------------------------------------------------------- */
/* Checklist (backtest pre-deposit red-flag rules)                            */
/* -------------------------------------------------------------------------- */

export interface ChecklistInput {
  poolAddress?: Address;
  chainId?: number;
  depositAmount?: Amount;
  days?: number;
  includeConfidence?: boolean;
}

export interface ChecklistItem {
  id: string;
  severity: 'go' | 'caution' | 'no_go';
  message: string;
  details?: unknown;
}

export type ChecklistVerdict = 'go' | 'caution' | 'no_go';

export interface ChecklistResult {
  verdict: ChecklistVerdict;
  items: ChecklistItem[];
}

/* -------------------------------------------------------------------------- */
/* Client configuration                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Optional constructor overrides for advanced consumers. Most callers
 * only need `baseUrl` and `apiKey`.
 */
export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  /** Default number of retries on 429/5xx (default 3, max 5). */
  maxRetries?: number;
  /** Base backoff in ms (default 250). Actual delay = baseBackoffMs * 2^attempt + jitter. */
  baseBackoffMs?: number;
  /** Cap on per-call wall time. Default 30_000ms. */
  timeoutMs?: number;
  /** Extra headers attached to every request. */
  defaultHeaders?: Record<string, string>;
  /**
   * Override `fetch` entirely (e.g. for custom retries, proxies, msw, …).
   * Defaults to the global `fetch` — Node 18+ has it built-in.
   */
  fetch?: typeof fetch;
}