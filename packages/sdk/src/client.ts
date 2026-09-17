/**
 * @univ3-strategy-lab/sdk — client implementation.
 *
 * Architectural notes:
 *   - Zero runtime dependencies. Uses native `fetch` (Node 18+ & browser).
 *   - Tree-shakeable: every public endpoint is a top-level exportable
 *     function (`backtestsRun`, `riskCompute`, `poolsDiscover`,
 *     `v4HooksDiscover`, `simulationsRun`) that takes a `UnivariateClient`.
 *     The class's namespace objects (`client.backtests.run`, …) are thin
 *     delegates, so bundlers can drop unused endpoints.
 *   - All non-2xx responses are normalised into `UnivariateError`.
 *   - Retries: 429 + 5xx, exponential backoff with full jitter,
 *     `Retry-After` honoured when present.
 *   - Every method accepts an optional `AbortSignal`; cancellation
 *     propagates to fetch and aborts any in-flight retry sleep.
 *   - Every successful response exposes `requestId` (header preferred,
 *     falls back to body field).
 */

import {
  UnivariateError,
  classifyApiError,
  type UnivariateErrorCode,
} from './errors.js';
import type {
  BacktestRunParams,
  BacktestRunResponse,
  ClientConfig,
  PoolsDiscoverParams,
  PoolsDiscoverResponse,
  RequestOptions,
  RiskComputeParams,
  RiskReportResponse,
  SimulationsRunParams,
  SimulationsRunResponse,
  V4HooksDiscoverParams,
  V4HooksDiscoverResponse,
  WithRequestIdHeader,
} from './types.js';

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 250;
const DEFAULT_TIMEOUT_MS = 30_000;
const USER_AGENT = '@univ3-strategy-lab/sdk/0.1.0';
/** Hard cap on per-attempt backoff so we never sleep for minutes. */
const MAX_BACKOFF_MS = 8_000;
/** Hard cap on configured retries so a misconfigured caller cannot DOS us. */
const MAX_RETRIES_LIMIT = 5;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Returns `true` for status codes we retry on. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/** Sleep helper that rejects when the signal aborts. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Build an `AbortError` indistinguishable from fetch's own DOMException. */
function abortError(signal: AbortSignal | undefined): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

/**
 * Parse the upstream `Retry-After` header (seconds or HTTP-date) into ms.
 * Returns `null` if missing/invalid so callers fall back to backoff.
 */
function parseRetryAfter(value: string | null, attempt: number, baseMs: number): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  }
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.min(Math.max(0, dateMs - Date.now()), MAX_BACKOFF_MS);
  }
  // Fall back to exponential backoff if header was unparseable.
  return Math.min(baseMs * 2 ** attempt + Math.floor(Math.random() * baseMs), MAX_BACKOFF_MS);
}

/** Full-jitter exponential backoff (bounded). */
function exponentialBackoffMs(attempt: number, baseMs: number): number {
  const exp = Math.min(baseMs * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.floor(Math.random() * exp);
}

/* -------------------------------------------------------------------------- */
/* Body conversion helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The upstream backtest route accepts tick-based input, but the SDK's
 * public surface takes price-based input (more usable). We convert.
 */
function buildBacktestBody(p: BacktestRunParams): Record<string, unknown> {
  // Tick spacing is derived from fee tier; defaults mirror the upstream defaults.
  const TICK_SPACING: Record<number, number> = {
    100: 1,
    500: 10,
    3000: 60,
    10000: 200,
  };
  const feeTier = p.feeTier ?? 3000;
  const spacing = TICK_SPACING[feeTier] ?? 60;

  // Convert prices to ticks using the standard sqrt-price math. We inline
  // a small wrapper because we do not want a viem dep.
  const priceToTick = (price: number): number => {
    if (price <= 0) throw new Error('price must be > 0');
    return Math.floor(Math.log(Math.sqrt(price)) / Math.log(1.0001));
  };
  // Snap to the spacing (matches upstream behaviour).
  const snap = (tick: number): number => Math.floor(tick / spacing) * spacing;
  const lowerTick = snap(priceToTick(p.lowerPrice));
  const upperTick = snap(priceToTick(p.upperPrice));

  // Dates: default to a 30-day window ending now.
  const end = new Date();
  const start = new Date(end.getTime() - (p.days ?? 30) * 86_400_000);

  const body: Record<string, unknown> = {
    chainId: p.chainId ?? 1,
    poolAddress: p.poolAddress,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    depositAmount: typeof p.depositAmount === 'number' ? String(p.depositAmount) : p.depositAmount,
    depositToken: p.depositToken,
    lowerTick,
    upperTick,
    rebalanceMode: p.rebalanceMode ?? 'none',
    gasCostGwei: p.gasCostGwei ?? 20,
  };
  if (p.rebalanceParams) body.rebalanceParams = p.rebalanceParams;
  if (p.useRealData !== undefined) body.useRealData = p.useRealData;
  if (p.days !== undefined) body.days = p.days;
  if (p.includeConfidence !== undefined) body.includeConfidence = p.includeConfidence;
  if (p.confidenceWindowDays !== undefined) body.confidenceWindowDays = p.confidenceWindowDays;
  if (p.checklistInput) body.checklistInput = p.checklistInput;
  return body;
}

function buildSimulationBody(p: SimulationsRunParams): Record<string, unknown> {
  const TICK_SPACING: Record<number, number> = {
    100: 1, 500: 10, 3000: 60, 10000: 200,
  };
  const feeTier = p.feeTier ?? 3000;
  const spacing = TICK_SPACING[feeTier] ?? 60;
  const priceToTick = (price: number): number => {
    if (price <= 0) throw new Error('price must be > 0');
    return Math.floor(Math.log(Math.sqrt(price)) / Math.log(1.0001));
  };
  const snap = (tick: number): number => Math.floor(tick / spacing) * spacing;
  const lowerTick = snap(priceToTick(p.lowerPrice));
  const upperTick = snap(priceToTick(p.upperPrice));

  const body: Record<string, unknown> = {
    chainId: p.chainId ?? 1,
    poolAddress: p.poolAddress,
    depositAmount: typeof p.depositAmount === 'number' ? String(p.depositAmount) : p.depositAmount,
    depositToken: p.depositToken,
    lowerTick,
    upperTick,
    type: p.type ?? 'deterministic',
    horizonDays: p.horizonDays ?? 30,
    volumeScenario: p.volumeScenario ?? 'base',
    rebalanceMode: p.rebalanceMode ?? 'none',
    gasCostGwei: p.gasCostGwei ?? 20,
  };
  if (p.priceScenario) body.priceScenario = p.priceScenario;
  if (p.customVolumeMultiplier !== undefined) body.customVolumeMultiplier = p.customVolumeMultiplier;
  if (p.rebalanceParams) body.rebalanceParams = p.rebalanceParams;
  return body;
}

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Typed API client for the univ3-strategy-lab service.
 *
 * Construct with a {@link ClientConfig}, then call methods on the
 * namespace objects (`client.backtests.run`, `client.risk.compute`, …).
 * Each namespace method is also exported as a standalone function so
 * unused endpoints can be tree-shaken.
 */
export class UnivariateClient {
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly maxRetries: number;
  readonly baseBackoffMs: number;
  readonly timeoutMs: number;
  readonly defaultHeaders: Readonly<Record<string, string>>;
  private readonly _fetch: typeof fetch;

  constructor(config: ClientConfig) {
    if (!config || typeof config.baseUrl !== 'string' || config.baseUrl.length === 0) {
      throw new Error('UnivariateClient: `baseUrl` is required.');
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.maxRetries = clamp(config.maxRetries ?? DEFAULT_MAX_RETRIES, 0, MAX_RETRIES_LIMIT);
    this.baseBackoffMs = Math.max(50, config.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS);
    this.timeoutMs = Math.max(1_000, config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.defaultHeaders = Object.freeze({ ...(config.defaultHeaders ?? {}) });
    this._fetch = config.fetch ?? globalThis.fetch;
    if (typeof this._fetch !== 'function') {
      throw new Error(
        'UnivariateClient: global `fetch` is unavailable. Pass `config.fetch` explicitly (Node 18+ has fetch built-in).',
      );
    }
  }

  /* ---- Public namespaces ---- */

  readonly backtests = {
    run: (params: BacktestRunParams, opts?: RequestOptions): Promise<BacktestRunResponse> =>
      backtestsRun(this, params, opts),
  };

  readonly risk = {
    compute: (params: RiskComputeParams, opts?: RequestOptions): Promise<RiskReportResponse> =>
      riskCompute(this, params, opts),
  };

  readonly pools = {
    discover: (params?: PoolsDiscoverParams, opts?: RequestOptions): Promise<PoolsDiscoverResponse> =>
      poolsDiscover(this, params, opts),
  };

  readonly v4 = {
    hooks: {
      discover: (params?: V4HooksDiscoverParams, opts?: RequestOptions): Promise<V4HooksDiscoverResponse> =>
        v4HooksDiscover(this, params, opts),
    },
  };

  readonly simulations = {
    run: (params: SimulationsRunParams, opts?: RequestOptions): Promise<SimulationsRunResponse> =>
      simulationsRun(this, params, opts),
  };

  /* ---- Core request method (also used internally) ---- */

  /**
   * Low-level request runner. Exposed so SDK consumers can hit routes
   * the typed methods don't cover yet.
   *
   * Always throws `UnivariateError` on non-2xx, never returns null.
   */
  async request<T extends WithRequestIdHeader>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    init: {
      json?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
      maxRetries?: number;
      baseBackoffMs?: number;
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    const url = buildUrl(this.baseUrl, path, init.query);
    const maxRetries = clamp(init.maxRetries ?? this.maxRetries, 0, MAX_RETRIES_LIMIT);
    const baseBackoff = Math.max(50, init.baseBackoffMs ?? this.baseBackoffMs);
    const timeoutMs = Math.max(1_000, init.timeoutMs ?? this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...this.defaultHeaders,
      ...(init.headers ?? {}),
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    let body: string | undefined;
    if (init.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.json);
    }

    let lastErr: UnivariateError | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Per-attempt timeout via AbortSignal so we don't pollute the caller's.
      const controller = new AbortController();
      const onCallerAbort = (): void => controller.abort(init.signal?.reason);
      init.signal?.addEventListener('abort', onCallerAbort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('request timeout')), timeoutMs);

      try {
        const res = await this._fetch(url, {
          method,
          headers,
          ...(body !== undefined ? { body } : {}),
          signal: controller.signal,
        });
        clearTimeout(timer);
        init.signal?.removeEventListener('abort', onCallerAbort);

        const requestId = (res.headers.get('x-request-id') ?? '').trim() || null;

        if (res.ok) {
          const text = await res.text();
          const data = text.length > 0 ? safeJsonParse(text) : null;
          if (data === null || typeof data !== 'object') {
            throw new UnivariateError({
              message: `Expected JSON response, got ${typeof data}`,
              status: res.status,
              code: 'internal',
              requestId,
              body: data,
              url,
              method,
            });
          }
          // Attach requestId even if the body already has one — header wins
          // because it is set by the route regardless of the body shape.
          attachRequestId(data as Record<string, unknown>, requestId);
          return data as T;
        }

        // Non-2xx
        const text = await res.text();
        const bodyParsed: unknown = text.length > 0 ? safeJsonParse(text) : null;
        const errField = (bodyParsed && typeof bodyParsed === 'object')
          ? (bodyParsed as Record<string, unknown>).error
          : undefined;
        const code = classifyApiError(errField, res.status);
        const message = errorMessageFromBody(bodyParsed, res.status);

        const err = new UnivariateError({
          message,
          status: res.status,
          code,
          requestId,
          body: bodyParsed,
          url,
          method,
        });
        lastErr = err;

        if (!isRetryableStatus(res.status)) {
          throw err;
        }
        // Retry path — fall through to backoff unless we've exhausted retries.
        if (attempt >= maxRetries) {
          throw err;
        }
        const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'), attempt, baseBackoff);
        const backoffMs = retryAfterMs ?? exponentialBackoffMs(attempt, baseBackoff);
        try {
          await sleep(backoffMs, init.signal);
        } catch (sleepErr) {
          // Caller aborted during retry sleep.
          throw new UnivariateError({
            message: 'Request aborted during retry backoff',
            status: 0,
            code: 'aborted',
            requestId,
            body: null,
            url,
            method,
            cause: sleepErr,
          });
        }
        continue;
      } catch (err) {
        clearTimeout(timer);
        init.signal?.removeEventListener('abort', onCallerAbort);

        // Already normalised by this loop.
        if (err instanceof UnivariateError) throw err;

        // Caller aborted.
        if (init.signal?.aborted || controller.signal.aborted) {
          throw new UnivariateError({
            message: 'Request aborted',
            status: 0,
            code: 'aborted',
            requestId: null,
            body: null,
            url,
            method,
            cause: err,
          });
        }

        // Network / TLS / DNS / etc. Retryable up to maxRetries.
        const code: UnivariateErrorCode = 'network';
        const wrapped = new UnivariateError({
          message: err instanceof Error ? err.message : 'Network error',
          status: 0,
          code,
          requestId: null,
          body: null,
          url,
          method,
          cause: err,
        });
        lastErr = wrapped;
        if (attempt >= maxRetries) throw wrapped;
        const backoffMs = exponentialBackoffMs(attempt, baseBackoff);
        try {
          await sleep(backoffMs, init.signal);
        } catch (sleepErr) {
          throw new UnivariateError({
            message: 'Request aborted during retry backoff',
            status: 0,
            code: 'aborted',
            requestId: null,
            body: null,
            url,
            method,
            cause: sleepErr,
          });
        }
      }
    }

    // Unreachable in practice — loop either returns or throws.
    throw lastErr ?? new UnivariateError({
      message: 'Request failed',
      status: 0,
      code: 'unknown',
      requestId: null,
      body: null,
      url,
      method,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Endpoint functions (tree-shakeable surface)                                 */
/* -------------------------------------------------------------------------- */

/** `POST /api/backtests` */
export function backtestsRun(
  client: UnivariateClient,
  params: BacktestRunParams,
  opts?: RequestOptions,
): Promise<BacktestRunResponse> {
  return client.request<BacktestRunResponse>('POST', '/api/backtests', {
    json: buildBacktestBody(params),
    signal: opts?.signal,
    maxRetries: opts?.maxRetries,
    baseBackoffMs: opts?.baseBackoffMs,
  });
}

/** `POST /api/analytics/risk` */
export function riskCompute(
  client: UnivariateClient,
  params: RiskComputeParams,
  opts?: RequestOptions,
): Promise<RiskReportResponse> {
  return client.request<RiskReportResponse>('POST', '/api/analytics/risk', {
    json: {
      equityCurve: params.equityCurve,
      riskFreeRate: params.riskFreeRate ?? 0,
      annualizationFactor: params.annualizationFactor ?? 252,
    },
    signal: opts?.signal,
    maxRetries: opts?.maxRetries,
    baseBackoffMs: opts?.baseBackoffMs,
  });
}

/** `GET /api/pools` */
export function poolsDiscover(
  client: UnivariateClient,
  params?: PoolsDiscoverParams,
  opts?: RequestOptions,
): Promise<PoolsDiscoverResponse> {
  const query: Record<string, string | number | boolean | undefined> = {};
  if (params) {
    if (params.chainId !== undefined) query.chainId = params.chainId;
    if (params.token) query.token = params.token;
    if (params.search) query.search = params.search;
    if (params.limit !== undefined) query.limit = params.limit;
  }
  return client.request<PoolsDiscoverResponse>('GET', '/api/pools', {
    query,
    signal: opts?.signal,
    maxRetries: opts?.maxRetries,
    baseBackoffMs: opts?.baseBackoffMs,
  });
}

/** `GET /api/v4/hooks` */
export function v4HooksDiscover(
  client: UnivariateClient,
  params?: V4HooksDiscoverParams,
  opts?: RequestOptions,
): Promise<V4HooksDiscoverResponse> {
  const query: Record<string, string | number | boolean | undefined> = {};
  if (params) {
    if (params.chainId !== undefined) query.chainId = params.chainId;
    if (params.category) query.category = params.category;
    if (params.auditedOnly !== undefined) query.auditedOnly = params.auditedOnly;
    if (params.baseAPR !== undefined) query.baseAPR = params.baseAPR;
    if (params.volatility !== undefined) query.volatility = params.volatility;
  }
  return client.request<V4HooksDiscoverResponse>('GET', '/api/v4/hooks', {
    query,
    signal: opts?.signal,
    maxRetries: opts?.maxRetries,
    baseBackoffMs: opts?.baseBackoffMs,
  });
}

/** `POST /api/simulations` */
export function simulationsRun(
  client: UnivariateClient,
  params: SimulationsRunParams,
  opts?: RequestOptions,
): Promise<SimulationsRunResponse> {
  return client.request<SimulationsRunResponse>('POST', '/api/simulations', {
    json: buildSimulationBody(params),
    signal: opts?.signal,
    maxRetries: opts?.maxRetries,
    baseBackoffMs: opts?.baseBackoffMs,
  });
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  // Encode path components but never double-encode slashes.
  const fullPath = path.startsWith('/') ? path : `/${path}`;
  if (!query) return `${baseUrl}${fullPath}`;
  const params: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return params.length === 0
    ? `${baseUrl}${fullPath}`
    : `${baseUrl}${fullPath}?${params.join('&')}`;
}

/** JSON.parse that returns `null` instead of throwing. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Pull a human-readable message out of an error body envelope.
 * Falls back to a generic status-based string when the body is malformed.
 */
function errorMessageFromBody(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.length > 0) return obj.message;
    if (typeof obj.error === 'string' && obj.error.length > 0) return obj.error;
  }
  if (typeof body === 'string' && body.length > 0) return body;
  return `HTTP ${status}`;
}

/**
 * Attach a `requestId` to the parsed body without overwriting a non-empty
 * value already present (header wins).
 */
function attachRequestId(obj: Record<string, unknown>, requestId: string | null): void {
  if (requestId === null) return;
  const existing = obj.requestId;
  if (typeof existing === 'string' && existing.length > 0) return;
  obj.requestId = requestId;
}