/**
 * Typed error surface for the @ticklab/sdk package.
 *
 * All non-success responses from the API are surfaced as `TicklabError`,
 * carrying enough metadata for a consumer to:
 *   - retry safely based on `code` + `status`
 *   - correlate with logs using `requestId`
 *   - inspect the raw body for downstream messages (`error`, `suggestion`)
 *   - propagate the underlying network failure via `cause` (the one place
 *     `unknown` is acceptable in the SDK; everything else is `never any`).
 */

/**
 * Discriminator for error categories. Maps onto both the upstream API
 * `error` field where present, and SDK-internal categories (`network`,
 * `aborted`) that the API cannot return.
 */
export type TicklabErrorCode =
  | 'rate_limit' // 429 — server told us to back off (Retry-After honoured)
  | 'validation' // 4xx — caller-side problem (bad params, unknown pool)
  | 'upstream' // 502/503/504 — upstream provider (CoinGecko, DeFi Llama, RPC)
  | 'internal' // 5xx other — server-side bug
  | 'network' // fetch threw (DNS, ECONNRESET, TLS, …)
  | 'aborted' // caller aborted via AbortSignal
  | 'unknown'; // anything we cannot classify

/**
 * Options accepted by the {@link TicklabError} constructor.
 */
export interface TicklabErrorOptions {
  message: string;
  /** HTTP status. `0` when the request never reached the server. */
  status: number;
  /** High-level category. */
  code: TicklabErrorCode;
  /** `x-request-id` header from the response, or `null` if unknown. */
  requestId: string | null;
  /** Parsed response body (object / null / undefined). Useful for surfacing upstream messages. */
  body: unknown;
  /** Request URL that failed. */
  url: string;
  /** Request method that failed. */
  method: string;
  /** Underlying error from fetch or upstream parser (typed as unknown per the spec). */
  cause?: unknown;
}

/**
 * The single error class thrown by this SDK.
 *
 * Properties are all `readonly` and are also exposed via {@link toJSON} for
 * structured logging.
 */
export class TicklabError extends Error {
  readonly name = 'TicklabError';
  readonly status: number;
  readonly code: TicklabErrorCode;
  readonly requestId: string | null;
  readonly body: unknown;
  readonly url: string;
  readonly method: string;
  /** Underlying error from fetch or upstream parser. `unknown` is intentional. */
  readonly cause: unknown;

  constructor(opts: TicklabErrorOptions) {
    super(opts.message);
    this.status = opts.status;
    this.code = opts.code;
    this.requestId = opts.requestId;
    this.body = opts.body;
    this.url = opts.url;
    this.method = opts.method;
    this.cause = opts.cause;
    // Preserve prototype chain after super() across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Plain-object representation suitable for `JSON.stringify` and
   * structured loggers. Excludes `cause` (cyclical risk) and `body`
   * (may contain huge payloads).
   */
  toJSON(): {
    name: string;
    message: string;
    status: number;
    code: TicklabErrorCode;
    requestId: string | null;
    url: string;
    method: string;
  } {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      requestId: this.requestId,
      url: this.url,
      method: this.method,
    };
  }

  /**
   * True for transient failures where retrying after backoff is likely to
   * succeed (`rate_limit`, `upstream`, `network`, `internal`).
   */
  get retryable(): boolean {
    return (
      this.code === 'rate_limit' ||
      this.code === 'upstream' ||
      this.code === 'internal' ||
      this.code === 'network'
    );
  }
}

/**
 * Coerce an API-level `error` string into our high-level code discriminator.
 * Falls back to `unknown` for any shape we cannot classify.
 */
export function classifyApiError(
  errorField: unknown,
  status: number,
): TicklabErrorCode {
  if (typeof errorField === 'string') {
    const e = errorField.toLowerCase();
    if (e === 'rate_limited' || e === 'rate_limit') return 'rate_limit';
    if (
      e === 'invalid_request' ||
      e === 'bad_request' ||
      e === 'validation_error' ||
      e === 'pool_not_indexed' ||
      e === 'pool_not_found' ||
      e === 'not_found'
    ) {
      return 'validation';
    }
    if (
      e === 'upstream_failure' ||
      e === 'upstream' ||
      e === 'service_unavailable'
    ) {
      return 'upstream';
    }
    if (e === 'internal_error') return 'internal';
  }
  if (status === 429) return 'rate_limit';
  if (status >= 400 && status < 500) return 'validation';
  if (status === 502 || status === 503 || status === 504) return 'upstream';
  if (status >= 500) return 'internal';
  return 'unknown';
}

/**
 * Type guard for {@link TicklabError}. Useful in callers that want to
 * branch on error category without catching every error.
 */
export function isTicklabError(err: unknown): err is TicklabError {
  return err instanceof TicklabError;
}