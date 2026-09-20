/**
 * Route inventory for the OpenAPI 3.1 spec.
 *
 * Every entry here is the contract for one route. Two rules to keep this
 * file maintainable:
 *
 *   1. Hand-maintain ONLY the response envelopes (the parts of the response
 *      that aren't already modeled as a Zod schema in the codebase).
 *      Request bodies and query params must reference the live Zod schemas
 *      so the spec cannot drift from the runtime validation.
 *
 *   2. If you add a new route, add a test assertion for it in
 *      `tests/openapi.test.ts` via `ROUTE_INVENTORY_PATHS`.
 *
 * Spec content is plain JSON-Schema-compatible objects so it can be embedded
 * verbatim into `paths.*.requestBody.content` / `paths.*.responses.*.content`.
 */

import { z } from 'zod';
import {
  ApiErrorSchema,
  ChainIdSchema,
  EthereumAddressSchema,
  JsonSchema,
  WarningSchema,
  registerSchema,
  zodRef,
  zodToJsonSchema,
} from './schemas';

import {
  backtestRequestSchema,
  simulationRequestSchema,
  tokenResolutionRequestSchema,
  poolDetailsRequestSchema,
  walletPositionsRequestSchema,
} from '@/lib/validation/schemas';
import { checklistInputSchema } from '@/lib/simulation/checklist';

/* -------------------------------------------------------------------------- */
/* Path-parameter slot                                                         */
/* -------------------------------------------------------------------------- */

/**
 * OpenAPI path templates use `{address}` / `{id}` style segments. Each
 * entry below resolves to one such template; parameters are documented
 * inline via `pathParams`.
 */
/**
 * An OpenAPI parameter object — `in`, `name`, `schema`, etc.
 *
 * Aliased as a loose record so callers don't have to import every
 * parameter shape; the spec builder does its own structural validation.
 */
export type OpenApiParameter = Record<string, unknown>;

export interface RouteEntry {
  /** Path template, e.g. `/api/pools/{address}`. */
  path: string;
  /** HTTP method (uppercase). */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** OpenAPI tag used for grouping in tooling. */
  tag: string;
  /** Short human summary shown in generated docs. */
  summary: string;
  /** Longer description shown as the doc body. */
  description?: string;
  /** OpenAPI operationId (unique per path+method). */
  operationId: string;
  /** Path-level parameters (e.g. `{address}` in `/api/pools/{address}`). */
  pathParams?: OpenApiParameter[];
  /** Query parameters — either inline parameter objects or `$ref`s. */
  queryParams?: OpenApiParameter[];
  /** Request body JSON schema (object, not the wrapper). */
  requestBodySchema?: JsonSchema;
  /** Per-status-code response bodies (e.g. `200`, `400`). */
  responses: Record<string, JsonSchema>;
}

/* -------------------------------------------------------------------------- */
/* Manual response schemas                                                     */
/* -------------------------------------------------------------------------- */

/* ----------------------------- /api/health --------------------------------- */

const HealthCheckSchema: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    ok: { type: 'boolean' },
    durationMs: { type: 'integer' },
    error: { type: 'string' },
  },
  required: ['name', 'ok', 'durationMs'],
  additionalProperties: false,
};
registerSchema('HealthCheck', HealthCheckSchema);

const HealthReportSchema: JsonSchema = {
  type: 'object',
  description:
    'Always returned with HTTP 200. Inspect `status` (`ok` vs `degraded`) and `checks[]` for the real signal.',
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    service: { type: 'string', examples: ['ticklab'] },
    uptimeSeconds: {
      type: 'integer',
      description: 'Rounded process uptime in seconds (back-compat field).',
    },
    uptime: {
      type: 'number',
      description: 'Raw `process.uptime()` in seconds (float).',
    },
    timestamp: { type: 'string', format: 'date-time' },
    version: { type: 'string' },
    buildSha: { type: 'string' },
    node: { type: 'string', description: 'Node.js version string.' },
    checks: {
      type: 'array',
      items: { $ref: '#/components/schemas/HealthCheck' },
    },
  },
  required: ['status', 'service', 'version', 'checks'],
  additionalProperties: true,
};
registerSchema('HealthReport', HealthReportSchema);

/* ----------------------------- /api/metrics -------------------------------- */

const PrometheusTextSchema: JsonSchema = {
  type: 'string',
  description:
    'Prometheus text exposition format (v0.0.4). See https://prometheus.io/docs/instrumenting/exposition_formats/',
  examples: [
    '# HELP ticklab_route_duration_ms Request duration in ms\n# TYPE ticklab_route_duration_ms summary\nticklab_route_duration_ms{quantile="0.5",route="pools.list"} 12\n',
  ],
};
registerSchema('PrometheusText', PrometheusTextSchema);

/* ----------------------------- /api/backtests ------------------------------ */

const BacktestResultSchema: JsonSchema = {
  type: 'object',
  description: 'BacktestResult — see lib/simulation/backtest.ts.',
  properties: {
    totalReturn: { type: 'number' },
    hodlReturn: { type: 'number' },
    excessReturn: { type: 'number' },
    totalFees: { type: 'number' },
    realizedIL: { type: 'number' },
    gasCosts: { type: 'number' },
    rebalanceCount: { type: 'integer' },
    timeInRange: { type: 'number' },
    periodsOutOfRange: { type: 'integer' },
    equityCurve: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'integer' },
          lpValue: { type: 'number' },
          hodlValue: { type: 'number' },
          fees: { type: 'number' },
        },
        required: ['timestamp', 'lpValue'],
        additionalProperties: false,
      },
    },
    drawdowns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'integer' },
          drawdown: { type: 'number' },
        },
        required: ['timestamp', 'drawdown'],
        additionalProperties: false,
      },
    },
    bestWindow: {
      type: 'object',
      properties: {
        start: { type: 'integer' },
        end: { type: 'integer' },
        return: { type: 'number' },
      },
      required: ['start', 'end', 'return'],
      additionalProperties: false,
    },
    worstWindow: {
      type: 'object',
      properties: {
        start: { type: 'integer' },
        end: { type: 'integer' },
        return: { type: 'number' },
      },
      required: ['start', 'end', 'return'],
      additionalProperties: false,
    },
  },
  required: ['totalReturn', 'equityCurve'],
  additionalProperties: true,
};
registerSchema('BacktestResult', BacktestResultSchema);

const BacktestResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    backtestId: { type: 'string' },
    useRealData: { type: 'boolean' },
    results: { $ref: '#/components/schemas/BacktestResult' },
    dataSource: { type: 'string' },
    dataPointsUsed: { type: 'integer' },
    fetchTimestamp: { type: 'string', format: 'date-time' },
    warnings: {
      type: 'array',
      items: { $ref: '#/components/schemas/BacktestWarning' },
    },
    requestId: { type: 'string' },
    confidenceBands: { $ref: '#/components/schemas/ConfidenceBands' },
    checklist: { $ref: '#/components/schemas/ChecklistResult' },
  },
  required: ['backtestId', 'useRealData', 'results', 'requestId'],
  additionalProperties: true,
};
registerSchema('BacktestResponse', BacktestResponseSchema);

const BacktestWarningSchema: JsonSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['sparse_data'] },
    severity: { type: 'string', enum: ['info'] },
    message: { type: 'string' },
    recommendation: { type: 'string' },
  },
  required: ['type', 'message'],
  additionalProperties: true,
};
registerSchema('BacktestWarning', BacktestWarningSchema);

/* Confidence bands + checklist — referenced from backtest/responses. */

const ConfidenceBandsSchema: JsonSchema = {
  type: 'object',
  description:
    'Percentile-based confidence band over per-window outcomes. See lib/simulation/confidence.ts.',
  properties: {
    n: { type: 'integer' },
    mean: { type: 'number' },
    stdDev: { type: 'number' },
    p5: { type: 'number' },
    p25: { type: 'number' },
    p50: { type: 'number' },
    p75: { type: 'number' },
    p95: { type: 'number' },
    probabilityOfLoss: { type: 'number' },
    worstDrawdown: { type: 'number' },
    bestWindow: { type: 'number' },
    worstWindow: { type: 'number' },
    ci90: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
    ci50: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['n', 'mean', 'stdDev', 'p5', 'p50', 'p95'],
  additionalProperties: true,
};
registerSchema('ConfidenceBands', ConfidenceBandsSchema);

const ChecklistResultSchema: JsonSchema = {
  type: 'object',
  properties: {
    overall: { type: 'string', enum: ['go', 'caution', 'no-go'] },
    score: { type: 'integer', minimum: 0, maximum: 100 },
    items: {
      type: 'array',
      items: { $ref: '#/components/schemas/ChecklistItem' },
    },
    blockedReasons: { type: 'array', items: { type: 'string' } },
    warnedReasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['overall', 'score', 'items'],
  additionalProperties: true,
};
registerSchema('ChecklistResult', ChecklistResultSchema);

const ChecklistItemSchema: JsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    severity: { type: 'string', enum: ['pass', 'info', 'warn', 'block'] },
    message: { type: 'string' },
    suggestion: { type: 'string' },
    evidence: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['id', 'label', 'severity', 'message'],
  additionalProperties: true,
};
registerSchema('ChecklistItem', ChecklistItemSchema);

/* ----------------------------- /api/analytics/risk ------------------------- */

const RiskReportSchema: JsonSchema = {
  type: 'object',
  description: 'RiskReport — see lib/analytics/risk-types.ts.',
  properties: {
    totalReturn: { type: 'number' },
    annualizedReturn: {
      type: 'number',
      nullable: true,
      description: '`null` when geometric annualization is undefined.',
    },
    annualizedVolatility: { type: 'number' },
    sharpeRatio: { type: 'number' },
    sortinoRatio: { type: 'number' },
    calmarRatio: { type: 'number' },
    maxDrawdown: { type: 'number' },
    valueAtRisk95: { type: 'number' },
    valueAtRisk99: { type: 'number' },
    conditionalVaR95: { type: 'number' },
    conditionalVaR99: { type: 'number' },
    ulcerIndex: { type: 'number' },
    burkeRatio: { type: 'number' },
    sampleSize: { type: 'integer' },
    annualizationFactor: { type: 'integer' },
    riskFreeRate: { type: 'number' },
  },
  required: [
    'totalReturn',
    'annualizedReturn',
    'annualizedVolatility',
    'sharpeRatio',
    'maxDrawdown',
    'sampleSize',
  ],
  additionalProperties: true,
};
registerSchema('RiskReport', RiskReportSchema);

/* ----------------------------- /api/pools + /api/pools/{address} ----------- */

const TokenSchema: JsonSchema = {
  type: 'object',
  properties: {
    chainId: ChainIdSchema,
    address: EthereumAddressSchema,
    symbol: { type: 'string' },
    name: { type: 'string' },
    decimals: { type: 'integer', minimum: 0, maximum: 255 },
    logoURI: { type: 'string', format: 'uri' },
    verified: { type: 'boolean' },
  },
  required: ['chainId', 'address', 'symbol', 'decimals'],
  additionalProperties: true,
};
registerSchema('Token', TokenSchema);

const PoolSchema: JsonSchema = {
  type: 'object',
  properties: {
    chainId: ChainIdSchema,
    address: EthereumAddressSchema,
    token0: { $ref: '#/components/schemas/Token' },
    token1: { $ref: '#/components/schemas/Token' },
    feeTier: { type: 'integer' },
    tickSpacing: { type: 'integer' },
    currentTick: { type: 'integer' },
    currentSqrtPriceX96: { type: 'string' },
    currentLiquidity: { type: 'string' },
    tvlUSD: { type: 'number' },
    volumeUSD24h: { type: 'number' },
    feesUSD24h: { type: 'number' },
    apr: { type: 'number' },
  },
  required: ['chainId', 'address', 'token0', 'token1', 'feeTier'],
  additionalProperties: true,
};
registerSchema('Pool', PoolSchema);

const PoolListResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    pools: { type: 'array', items: { $ref: '#/components/schemas/Pool' } },
    count: { type: 'integer' },
    chainId: ChainIdSchema,
    sortOptions: {
      type: 'array',
      items: { type: 'string' },
      examples: [['tvl', 'volume', 'apr', 'feeTier']],
    },
  },
  required: ['pools', 'count'],
  additionalProperties: true,
};
registerSchema('PoolListResponse', PoolListResponseSchema);

const PoolDetailsResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    pool: { $ref: '#/components/schemas/Pool' },
    currentState: {
      type: 'object',
      properties: {
        sqrtPriceX96: { type: 'string' },
        tick: { type: 'integer' },
        liquidity: { type: 'string' },
        token0Price: { type: 'number' },
        token1Price: { type: 'number' },
      },
      additionalProperties: true,
    },
    metrics: {
      type: 'object',
      properties: {
        tvlUSD: { type: 'number' },
        volumeUSD24h: { type: 'number' },
        feesUSD24h: { type: 'number' },
        apr: { type: 'number' },
      },
      additionalProperties: true,
    },
    warnings: { type: 'array', items: { $ref: '#/components/schemas/Warning' } },
  },
  required: ['pool'],
  additionalProperties: true,
};
registerSchema('PoolDetailsResponse', PoolDetailsResponseSchema);
registerSchema('Warning', WarningSchema);

/* ----------------------------- /api/simulations ---------------------------- */

const ScenarioPointSchema: JsonSchema = {
  type: 'object',
  properties: {
    exitPrice: { type: 'number' },
    priceChangePercent: { type: 'number' },
    lpValue: { type: 'number' },
    hodlValue: { type: 'number' },
    feesEarned: { type: 'number' },
    gasCosts: { type: 'number' },
    netReturn: { type: 'number' },
    excessReturnVsHODL: { type: 'number' },
    divergenceLoss: { type: 'number' },
    token0Amount: { type: 'number' },
    token1Amount: { type: 'number' },
    inRange: { type: 'boolean' },
  },
  required: ['exitPrice', 'lpValue', 'inRange'],
  additionalProperties: true,
};
registerSchema('ScenarioPoint', ScenarioPointSchema);

const FeeEstimateSchema: JsonSchema = {
  type: 'object',
  properties: {
    min: { type: 'number' },
    base: { type: 'number' },
    max: { type: 'number' },
    feesUSD: { type: 'number' },
    confidenceInterval: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['min', 'base', 'max'],
  additionalProperties: true,
};
registerSchema('FeeEstimate', FeeEstimateSchema);

const SimulationResultsSchema: JsonSchema = {
  type: 'object',
  properties: {
    scenarioGrid: {
      type: 'array',
      items: { $ref: '#/components/schemas/ScenarioPoint' },
    },
    feeEstimates: { $ref: '#/components/schemas/FeeEstimate' },
    summary: {
      type: 'object',
      properties: {
        estimatedFeesMin: { type: 'number' },
        estimatedFeesMax: { type: 'number' },
        estimatedIL: { type: 'number' },
        netReturnVsHODL: { type: 'number' },
        timeInRange: { type: 'number' },
      },
      required: ['timeInRange'],
      additionalProperties: true,
    },
  },
  required: ['scenarioGrid'],
  additionalProperties: true,
};
registerSchema('SimulationResults', SimulationResultsSchema);

const SimulationResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    simulationId: { type: 'string' },
    results: { $ref: '#/components/schemas/SimulationResults' },
    charts: {
      type: 'object',
      description:
        'Chart-ready data (Chart.js shape) for the UI; safe to ignore for programmatic consumers.',
      additionalProperties: true,
    },
    warnings: { type: 'array', items: { $ref: '#/components/schemas/Warning' } },
  },
  required: ['simulationId', 'results'],
  additionalProperties: true,
};
registerSchema('SimulationResponse', SimulationResponseSchema);

/* ----------------------------- /api/v4/pools ------------------------------- */

const V4PoolSchema: JsonSchema = {
  type: 'object',
  description: 'V4Pool — extends the base Pool shape with a poolId + poolKey.',
  properties: {
    ...(PoolSchema.properties as Record<string, JsonSchema>),
    poolId: {
      type: 'string',
      description: 'bytes32 keccak256(poolKey) — the on-chain identifier.',
    },
    poolKey: {
      type: 'object',
      properties: {
        currency0: EthereumAddressSchema,
        currency1: EthereumAddressSchema,
        fee: { type: 'integer' },
        tickSpacing: { type: 'integer' },
        hooks: EthereumAddressSchema,
      },
      required: ['currency0', 'currency1', 'fee', 'tickSpacing', 'hooks'],
      additionalProperties: false,
    },
    hookAddress: EthereumAddressSchema,
    hookName: { type: 'string' },
    isV4: { type: 'boolean', enum: [true] },
  },
  required: ['chainId', 'address', 'token0', 'token1', 'feeTier', 'poolId', 'poolKey', 'isV4'],
  additionalProperties: true,
};
registerSchema('V4Pool', V4PoolSchema);

const V4PoolsResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    chainId: ChainIdSchema,
    mode: { type: 'string', enum: ['pair', 'single'] },
    pools: { type: 'array', items: { $ref: '#/components/schemas/V4Pool' } },
    count: { type: 'integer' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['chainId', 'mode', 'pools', 'count'],
  additionalProperties: true,
};
registerSchema('V4PoolsResponse', V4PoolsResponseSchema);

/* ----------------------------- /api/v4/simulate ---------------------------- */

const V4SimulationResultSchema: JsonSchema = {
  type: 'object',
  properties: {
    scenarios: {
      type: 'array',
      items: {
        allOf: [
          { $ref: '#/components/schemas/ScenarioPoint' },
          {
            type: 'object',
            properties: {
              hookShareUSD: { type: 'number' },
              gasOverheadUSD: { type: 'number' },
              effectiveFeeRate: { type: 'number' },
              flowCapture: { type: 'number' },
            },
            additionalProperties: true,
          },
        ],
      },
    },
    baseCase: { $ref: '#/components/schemas/ScenarioPoint' },
    bestCase: { $ref: '#/components/schemas/ScenarioPoint' },
    worstCase: { $ref: '#/components/schemas/ScenarioPoint' },
    hookAnalysis: {
      type: 'object',
      additionalProperties: true,
      properties: {
        hookId: { type: 'string' },
        hookName: { type: 'string' },
        baseAPR: { type: 'number' },
        hookAdjustedAPR: { type: 'number' },
        riskScore: { type: 'number' },
        complexityScore: { type: 'number' },
        recommendation: { type: 'string' },
      },
    },
    rangeAnalysis: {
      type: 'object',
      properties: {
        lowerPrice: { type: 'number' },
        upperPrice: { type: 'number' },
        tickWidth: { type: 'integer' },
        estimatedTimeInRange: { type: 'number' },
      },
      additionalProperties: true,
    },
  },
  required: ['scenarios', 'rangeAnalysis'],
  additionalProperties: true,
};
registerSchema('V4SimulationResult', V4SimulationResultSchema);

const OptimizedRangeSchema: JsonSchema = {
  type: 'object',
  properties: {
    lowerPrice: { type: 'number' },
    upperPrice: { type: 'number' },
    tickWidth: { type: 'integer' },
    estimatedTimeInRange: { type: 'number' },
    hookBonusFactor: { type: 'number' },
  },
  required: ['lowerPrice', 'upperPrice', 'tickWidth'],
  additionalProperties: true,
};
registerSchema('OptimizedRange', OptimizedRangeSchema);

const V4SimulateResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    simulation: { $ref: '#/components/schemas/V4SimulationResult' },
    optimizedRange: { $ref: '#/components/schemas/OptimizedRange' },
  },
  required: ['simulation'],
  additionalProperties: true,
};
registerSchema('V4SimulateResponse', V4SimulateResponseSchema);

/* ----------------------------- /api/v4/hooks ------------------------------- */

const HookBehaviorsSchema: JsonSchema = {
  type: 'object',
  properties: {
    feeAdjustment: { type: 'string' },
    baseFeeBips: { type: 'integer' },
    additionalFeeBips: { type: 'integer' },
    hookShareBips: { type: 'integer' },
    gasOverheadPerSwap: { type: 'integer' },
    flowMultiplier: { type: 'number' },
    lockupPeriodDays: { type: 'integer' },
    requiresStaking: { type: 'boolean' },
    auditStatus: {
      type: 'string',
      enum: ['audited', 'partial', 'unaudited', 'experimental', 'unknown'],
    },
    description: { type: 'string' },
    lpImpact: { type: 'string' },
  },
  required: ['feeAdjustment', 'auditStatus'],
  additionalProperties: true,
};
registerSchema('HookBehaviors', HookBehaviorsSchema);

const HookListItemSchema: JsonSchema = {
  type: 'object',
  properties: {
    hookId: { type: 'string' },
    name: { type: 'string' },
    category: {
      type: 'string',
      enum: ['fee', 'liquidity', 'flow', 'yield', 'risk', 'access', 'custom'],
    },
    chains: { type: 'array', items: ChainIdSchema },
    address: EthereumAddressSchema,
    behaviors: { $ref: '#/components/schemas/HookBehaviors' },
    score: {
      type: 'object',
      description: 'calculateHookLPScore output. Shape intentionally open.',
      additionalProperties: true,
    },
  },
  required: ['hookId', 'name', 'category', 'address'],
  additionalProperties: true,
};
registerSchema('HookListItem', HookListItemSchema);

const HookListResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    hooks: { type: 'array', items: { $ref: '#/components/schemas/HookListItem' } },
    count: { type: 'integer' },
  },
  required: ['hooks', 'count'],
  additionalProperties: true,
};
registerSchema('HookListResponse', HookListResponseSchema);

/* ----------------------------- /api/v4/hooks/recommend ---------------------- */

const HookRecommendationSchema: JsonSchema = {
  type: 'object',
  description: 'recommendHooks() return value — shape intentionally open.',
  additionalProperties: true,
};
registerSchema('HookRecommendation', HookRecommendationSchema);

const HookRecommendResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: { $ref: '#/components/schemas/HookRecommendation' },
    },
    count: { type: 'integer' },
  },
  required: ['recommendations', 'count'],
  additionalProperties: true,
};
registerSchema('HookRecommendResponse', HookRecommendResponseSchema);

/* ----------------------------- /api/wallet/positions ------------------------ */

const WalletPositionSchema: JsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    chainId: ChainIdSchema,
    pool: { $ref: '#/components/schemas/Pool' },
    tickLower: { type: 'integer' },
    tickUpper: { type: 'integer' },
    liquidity: { type: 'string' },
    currentAmounts: {
      type: 'object',
      nullable: true,
      properties: {
        token0: { type: 'number' },
        token1: { type: 'number' },
      },
      additionalProperties: true,
    },
    unclaimedFees: {
      type: 'object',
      nullable: true,
      properties: {
        token0: { type: 'number' },
        token1: { type: 'number' },
      },
      additionalProperties: true,
    },
    inRange: { type: 'boolean', nullable: true },
    currentTick: { type: 'integer', nullable: true },
  },
  required: ['tickLower', 'tickUpper'],
  additionalProperties: true,
};
registerSchema('WalletPosition', WalletPositionSchema);

const WalletPositionsResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    positions: {
      type: 'array',
      items: { $ref: '#/components/schemas/WalletPosition' },
    },
    summary: {
      type: 'object',
      properties: {
        totalPositions: { type: 'integer' },
        positionsInRange: { type: 'integer' },
        positionsOutOfRange: { type: 'integer' },
      },
      required: ['totalPositions', 'positionsInRange', 'positionsOutOfRange'],
      additionalProperties: false,
    },
  },
  required: ['positions', 'summary'],
  additionalProperties: true,
};
registerSchema('WalletPositionsResponse', WalletPositionsResponseSchema);

/* ----------------------------- /api/positions/{id}/analytics ---------------- */

const PositionAnalyticsResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    position: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        chainId: ChainIdSchema,
        pool: { $ref: '#/components/schemas/Pool' },
        tickLower: { type: 'integer' },
        tickUpper: { type: 'integer' },
        liquidity: { type: 'string' },
      },
      required: ['tickLower', 'tickUpper', 'liquidity'],
      additionalProperties: true,
    },
    currentValue: {
      type: 'object',
      properties: {
        token0Amount: { type: 'number' },
        token1Amount: { type: 'number' },
        token0ValueUSD: { type: 'number' },
        token1ValueUSD: { type: 'number' },
        totalValueUSD: { type: 'number' },
      },
      required: ['totalValueUSD'],
      additionalProperties: true,
    },
    unclaimedFees: {
      type: 'object',
      properties: {
        token0: { type: 'number' },
        token1: { type: 'number' },
        usd: { type: 'number' },
      },
      required: ['usd'],
      additionalProperties: true,
    },
    poolState: {
      type: 'object',
      properties: {
        tick: { type: 'integer' },
        price: { type: 'number' },
        inRange: { type: 'boolean' },
      },
      required: ['tick', 'inRange'],
      additionalProperties: true,
    },
    scenarios: {
      type: 'object',
      description: 'Currently a placeholder; will receive scenario results in a future iteration.',
      additionalProperties: true,
    },
  },
  required: ['position', 'currentValue'],
  additionalProperties: true,
};
registerSchema('PositionAnalyticsResponse', PositionAnalyticsResponseSchema);

/* ----------------------------- /api/tokens/resolve ------------------------ */

const TokenResolveResponseSchema: JsonSchema = {
  type: 'object',
  properties: {
    token: {
      type: 'object',
      description: 'Token metadata — see fetchTokenMetadata().',
      additionalProperties: true,
    },
    pools: { type: 'array', items: { $ref: '#/components/schemas/Pool' } },
    warnings: { type: 'array', items: { $ref: '#/components/schemas/Warning' } },
  },
  required: ['token', 'pools'],
  additionalProperties: true,
};
registerSchema('TokenResolveResponse', TokenResolveResponseSchema);

/* -------------------------------------------------------------------------- */
/* Reusable wrappers                                                            */
/* -------------------------------------------------------------------------- */

const StandardErrorResponses: Record<string, JsonSchema> = {
  '400': {
    description: 'Invalid request — zod validation failed or required parameters missing.',
    content: {
      'application/json': {
        schema: ApiErrorSchema,
      },
    },
  },
  '404': {
    description: 'Resource not found (pool, position, token).',
    content: {
      'application/json': {
        schema: ApiErrorSchema,
      },
    },
  },
  '429': {
    description: 'Rate limit exceeded.',
    content: {
      'application/json': {
        schema: ApiErrorSchema,
      },
    },
  },
  '500': {
    description: 'Server error.',
    content: {
      'application/json': {
        schema: ApiErrorSchema,
      },
    },
  },
};

/** Convert a JSON Schema into an OpenAPI "media-type" wrapper. */
function jsonMedia(schema: JsonSchema): JsonSchema {
  return {
    content: {
      'application/json': { schema },
    },
  };
}

/** Convert a JSON Schema into an OpenAPI "text/plain" wrapper. */
function textMedia(schema: JsonSchema): JsonSchema {
  return {
    content: {
      'text/plain': { schema },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

const SimulationRequestBody = zodRef('SimulationRequest', simulationRequestSchema);
const BacktestRequestBody = zodRef('BacktestRequest', backtestRequestSchema);
const ChecklistRequestBody = zodRef('ChecklistRequest', checklistInputSchema);
const ConfidenceRequestBody = zodRef(
  'ConfidenceRequest',
  z.object({
    windowOutcomes: z.array(z.number()).min(5).max(1000),
    bootstrapSamples: z.number().int().positive().max(10000).optional(),
    percentiles: z.array(z.number().min(0).max(100)).min(1).max(20).optional(),
    seed: z.number().int().nonnegative().optional(),
  }),
);
const RiskRequestBody = zodRef(
  'RiskRequest',
  z.object({
    equityCurve: z
      .array(z.object({ timestamp: z.number().finite(), lpValue: z.number().finite() }))
      .min(2),
    riskFreeRate: z.number().finite().optional(),
    annualizationFactor: z.number().int().positive().max(100_000).optional(),
  }),
);
const WalletPositionsQuery = zodRef('WalletPositionsQuery', walletPositionsRequestSchema);
const PoolAddressQuery = zodRef('PoolAddressQuery', poolDetailsRequestSchema);
const TokenResolveQuery = zodRef('TokenResolveQuery', tokenResolutionRequestSchema);
// The route accepts `search` + `token` + `chainId` + `limit` — we model
// it as an inline query schema since `poolDiscoveryRequestSchema` in
// lib/validation/schemas.ts does not yet cover `search` / `limit`.
const PoolsQuery = zodRef(
  'PoolsQuery',
  z.object({
    chainId: z.number().int().positive().default(1),
    token: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    search: z.string().optional(),
    limit: z.number().int().positive().max(50).default(20),
  }),
);

const V4PoolsQuery = zodRef(
  'V4PoolsQuery',
  z.object({
    chainId: z.coerce.number().int().positive().default(1),
    mode: z.enum(['pair', 'single']).default('pair'),
    tokenA: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    tokenB: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    knownHookAddresses: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
  }),
);

const V4SimulateBody = zodRef(
  'V4SimulateRequest',
  z.object({
    entryPrice: z.number().positive(),
    lowerPrice: z.number().positive(),
    upperPrice: z.number().positive(),
    depositAmount: z.number().positive(),
    depositToken: z.enum(['token0', 'token1', 'usd']).default('usd'),
    baseFeeTier: z.number().int().positive(),
    volume24h: z.number().nonnegative(),
    poolLiquidity: z.union([z.string(), z.number()]),
    yourLiquidity: z.union([z.string(), z.number()]),
    horizonDays: z.number().int().positive().max(365),
    gasCostGwei: z.number().nonnegative().default(20),
    hookId: z.string().optional(),
    hookAddress: z.string().optional(),
    isStaking: z.boolean().optional(),
    volatility: z.number().nonnegative().max(5),
    estimatedDailySwaps: z.number().int().nonnegative().default(50),
    optimizeRange: z.boolean().optional(),
  }),
);

const V4HooksQuery = zodRef(
  'V4HooksQuery',
  z.object({
    chainId: z.coerce.number().int().positive().optional(),
    category: z
      .enum(['fee', 'liquidity', 'flow', 'yield', 'risk', 'access', 'custom'])
      .optional(),
    auditedOnly: z.coerce.boolean().optional(),
    baseAPR: z.coerce.number().nonnegative().optional(),
    volatility: z.coerce.number().nonnegative().optional(),
  }),
);

const V4HookRecommendBody = zodRef(
  'V4HookRecommendRequest',
  z.object({
    pairSymbol: z.string().optional(),
    chainId: z.number().int().positive(),
    baseAPR: z.number().nonnegative(),
    volatility: z.number().nonnegative().max(5),
    riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
    timeHorizonDays: z.number().int().positive().default(30),
    maxResults: z.number().int().positive().max(20).default(5),
  }),
);

// `checklistInputSchema` is imported at the top alongside the other
// zod schemas so the body schema is generated from the same source the
// runtime validator uses.

/* -------------------------------------------------------------------------- */
/* The inventory                                                               */
/* -------------------------------------------------------------------------- */

export const ROUTE_INVENTORY: RouteEntry[] = [
  /* ------------------------ /api/health ---------------------------------- */
  {
    path: '/api/health',
    method: 'GET',
    tag: 'health',
    operationId: 'getHealth',
    summary: 'Liveness + dependency smoke-checks.',
    description:
      'Always returns HTTP 200. Inspect `status` (`ok` | `degraded`) and `checks[]` for the real signal — load balancers can treat any reachable response as "process up" while a real APM watches for `degraded`.',
    responses: {
      '200': {
        description: 'Health report. The HTTP status is always 200 by design.',
        ...jsonMedia({ $ref: '#/components/schemas/HealthReport' }),
      },
    },
  },

  /* ------------------------ /api/metrics --------------------------------- */
  {
    path: '/api/metrics',
    method: 'GET',
    tag: 'metrics',
    operationId: 'getMetrics',
    summary: 'Prometheus text-format metrics.',
    description:
      'Prometheus exposition format (v0.0.4). Safe to scrape at any frequency; cache TTL is 30s server-side. **Not JSON** — content-type is `text/plain; version=0.0.4`.',
    responses: {
      '200': {
        description: 'Metrics payload in Prometheus text exposition format.',
        ...textMedia({ $ref: '#/components/schemas/PrometheusText' }),
      },
    },
  },

  /* ------------------------ /api/backtests ------------------------------- */
  {
    path: '/api/backtests',
    method: 'POST',
    tag: 'backtests',
    operationId: 'runBacktest',
    summary: 'Run a historical backtest.',
    description:
      'Runs an LP backtest over the requested window. Defaults to synthetic price data unless `useRealData: true` is supplied — in which case DeFi Llama volumes + CoinGecko prices are used (with model fallback when no history exists).',
    requestBodySchema: BacktestRequestBody,
    responses: {
      '200': {
        description: 'Backtest completed successfully.',
        ...jsonMedia({ $ref: '#/components/schemas/BacktestResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/backtests/confidence ------------------- */
  {
    path: '/api/backtests/confidence',
    method: 'POST',
    tag: 'backtests',
    operationId: 'computeBacktestConfidence',
    summary: 'Compute percentile confidence bands from per-window outcomes.',
    description:
      'Pure compute endpoint. No caching. Returns p5/p25/p50/p75/p95 + bootstrap-corrected stddev when n < 30.',
    requestBodySchema: ConfidenceRequestBody,
    responses: {
      '200': {
        description: 'ConfidenceBands result.',
        ...jsonMedia({ $ref: '#/components/schemas/ConfidenceBands' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/backtests/checklist -------------------- */
  {
    path: '/api/backtests/checklist',
    method: 'POST',
    tag: 'backtests',
    operationId: 'runBacktestChecklist',
    summary: 'Pre-deposit red-flag checklist.',
    description:
      'Runs the pure `runChecklist` engine against the supplied snapshot. Returns overall `go | caution | no-go` + per-rule items sorted by severity.',
    requestBodySchema: ChecklistRequestBody,
    responses: {
      '200': {
        description: 'ChecklistResult.',
        ...jsonMedia({ $ref: '#/components/schemas/ChecklistResult' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/analytics/risk ------------------------- */
  {
    path: '/api/analytics/risk',
    method: 'POST',
    tag: 'risk',
    operationId: 'computeRiskReport',
    summary: 'Compute a full A16Z-grade risk report for an equity curve.',
    description:
      'Returns Sharpe / Sortino / Calmar / VaR / CVaR / Ulcer / Burke ratios over the supplied equity curve. Pure CPU-bound.',
    requestBodySchema: RiskRequestBody,
    responses: {
      '200': {
        description: 'RiskReport.',
        ...jsonMedia({ $ref: '#/components/schemas/RiskReport' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/pools ----------------------------------- */
  {
    path: '/api/pools',
    method: 'GET',
    tag: 'pools',
    operationId: 'listPools',
    summary: 'Discover V3 pools.',
    description:
      'Returns top pools (default), or pools containing `token`, or pools matching `search`. Limited to `limit` (default 20, max 50).',
    queryParams: [{ $ref: '#/components/schemas/PoolsQuery' }],
    responses: {
      '200': {
        description: 'Pool list response.',
        ...jsonMedia({ $ref: '#/components/schemas/PoolListResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/pools/{address} ------------------------- */
  {
    path: '/api/pools/{address}',
    method: 'GET',
    tag: 'pools',
    operationId: 'getPoolByAddress',
    summary: 'Pool details by address.',
    description:
      'Returns the pool plus its current on-chain state (liquidity, tick) and metrics (TVL, 24h volume).',
    pathParams: [
      {
        name: 'address',
        in: 'path',
        required: true,
        schema: EthereumAddressSchema,
        description: 'Pool contract address.',
      },
    ],
    queryParams: [{ $ref: '#/components/schemas/PoolAddressQuery' }],
    responses: {
      '200': {
        description: 'Pool detail response.',
        ...jsonMedia({ $ref: '#/components/schemas/PoolDetailsResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/simulations ----------------------------- */
  {
    path: '/api/simulations',
    method: 'POST',
    tag: 'simulations',
    operationId: 'runSimulation',
    summary: 'Run a deterministic scenario simulation.',
    description:
      'Generates a 50-step price grid and computes LP vs HODL outcomes plus fee estimates at low/base/high volume scenarios.',
    requestBodySchema: SimulationRequestBody,
    responses: {
      '200': {
        description: 'Simulation result + chart-ready data.',
        ...jsonMedia({ $ref: '#/components/schemas/SimulationResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/v4/pools -------------------------------- */
  {
    path: '/api/v4/pools',
    method: 'GET',
    tag: 'v4',
    operationId: 'discoverV4Pools',
    summary: 'Discover Uniswap V4 pools.',
    description:
      'Returns the subset of (feeTier × hooks) combinations where PoolManager confirms the pool exists. Cached for 60s.',
    queryParams: [{ $ref: '#/components/schemas/V4PoolsQuery' }],
    responses: {
      '200': {
        description: 'V4 pool discovery response.',
        ...jsonMedia({ $ref: '#/components/schemas/V4PoolsResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/v4/simulate ----------------------------- */
  {
    path: '/api/v4/simulate',
    method: 'POST',
    tag: 'v4',
    operationId: 'simulateV4LP',
    summary: 'Run a V4 hook-aware scenario simulation.',
    description:
      'Extends the V3 simulator with hook-aware fee/flow adjustments. Optionally returns an `optimizedRange` block when `optimizeRange: true`.',
    requestBodySchema: V4SimulateBody,
    responses: {
      '200': {
        description: 'V4 simulation result + optional optimized range.',
        ...jsonMedia({ $ref: '#/components/schemas/V4SimulateResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/v4/hooks -------------------------------- */
  {
    path: '/api/v4/hooks',
    method: 'GET',
    tag: 'v4',
    operationId: 'listV4Hooks',
    summary: 'List registered V4 hooks.',
    description:
      'Returns the hook registry filtered by `chainId`, `category`, and `auditedOnly`. Each entry carries a computed LP score based on `baseAPR` / `volatility`. Cached for 5 minutes.',
    queryParams: [{ $ref: '#/components/schemas/V4HooksQuery' }],
    responses: {
      '200': {
        description: 'Hook list response.',
        ...jsonMedia({ $ref: '#/components/schemas/HookListResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/v4/hooks/recommend ---------------------- */
  {
    path: '/api/v4/hooks/recommend',
    method: 'POST',
    tag: 'v4',
    operationId: 'recommendV4Hooks',
    summary: 'Recommend hooks for a strategy profile.',
    description:
      'Filters and ranks the hook registry against the supplied strategy snapshot. `maxResults` defaults to 5, capped at 20.',
    requestBodySchema: V4HookRecommendBody,
    responses: {
      '200': {
        description: 'Hook recommendations.',
        ...jsonMedia({ $ref: '#/components/schemas/HookRecommendResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/wallet/positions ------------------------ */
  {
    path: '/api/wallet/positions',
    method: 'GET',
    tag: 'wallet',
    operationId: 'getWalletPositions',
    summary: 'List LP positions owned by an EVM address.',
    description:
      'Returns all V3 positions for the wallet on the requested chain, decorated with current amounts, unclaimed fees, and an in-range flag.',
    queryParams: [{ $ref: '#/components/schemas/WalletPositionsQuery' }],
    responses: {
      '200': {
        description: 'Wallet positions response.',
        ...jsonMedia({ $ref: '#/components/schemas/WalletPositionsResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/positions/{id}/analytics ---------------- */
  {
    path: '/api/positions/{id}/analytics',
    method: 'GET',
    tag: 'wallet',
    operationId: 'getPositionAnalytics',
    summary: 'Per-position analytics.',
    description:
      'Returns current value, unclaimed fees, and pool state for a single position identified by its NFT tokenId.',
    pathParams: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'NFT tokenId of the position.',
      },
    ],
    queryParams: [
      {
        name: 'chainId',
        in: 'query',
        required: false,
        schema: ChainIdSchema,
        description: 'EVM chain ID (default 1).',
      },
    ],
    responses: {
      '200': {
        description: 'Position analytics response.',
        ...jsonMedia({ $ref: '#/components/schemas/PositionAnalyticsResponse' }),
      },
      ...StandardErrorResponses,
    },
  },

  /* ------------------------ /api/tokens/resolve ------------------------- */
  {
    path: '/api/tokens/resolve',
    method: 'GET',
    tag: 'pools',
    operationId: 'resolveToken',
    summary: 'Resolve an ERC-20 token by address.',
    description:
      'Fetches metadata from RPC and lists V3 pools containing the token. Emits warnings when the token has no pools or low liquidity.',
    queryParams: [{ $ref: '#/components/schemas/TokenResolveQuery' }],
    responses: {
      '200': {
        description: 'Token resolution response.',
        ...jsonMedia({ $ref: '#/components/schemas/TokenResolveResponse' }),
      },
      ...StandardErrorResponses,
    },
  },
];

/**
 * Pre-computed lookup: map `<METHOD> <path>` → RouteEntry. Used by the
 * spec builder and by tests to assert coverage.
 */
export const ROUTE_INDEX: ReadonlyMap<string, RouteEntry> = (() => {
  const m = new Map<string, RouteEntry>();
  for (const r of ROUTE_INVENTORY) m.set(`${r.method} ${r.path}`, r);
  return m;
})();