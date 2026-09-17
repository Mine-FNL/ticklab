/**
 * Standardised API route handler with:
 *   - Zod request validation (query or body)
 *   - Consistent error envelope
 *   - Optional per-route in-memory cache
 *   - Optional rate limiting
 *   - Structured request logging
 *
 * Usage:
 *   export const { dynamic, runtime } = apiConfig();
 *   export const GET = apiHandler({
 *     name: 'pools.list',
 *     schema: listSchema,
 *     cacheTtlMs: 60_000,
 *     rateLimit: RateLimitPresets.read,
 *   }, async ({ params, request }) => {
 *     return apiOk({ pools });
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { consume, clientIp, RateLimitConfig } from './rate-limit';
import { cached } from './cache';
import { recordMetric } from './metrics';

/* -------------------------------------------------------------------------- */
/* Route module config (dynamic, runtime)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Returns the standard export values every API route should re-export.
 * Force-dynamic because we always read request input; nodejs runtime because
 * viem/RPC clients are not Edge-compatible.
 */
export function apiConfig() {
  return {
    dynamic: 'force-dynamic' as const,
    runtime: 'nodejs' as const,
  };
}

/* -------------------------------------------------------------------------- */
/* Error envelope                                                              */
/* -------------------------------------------------------------------------- */

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
  suggestion?: string;
  requestId?: string;
}

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function apiFail(status: number, body: ApiError): NextResponse {
  return NextResponse.json(body, { status });
}

/* -------------------------------------------------------------------------- */
/* Logging                                                                     */
/* -------------------------------------------------------------------------- */

let _requestCounter = 0;
function nextRequestId(): string {
  _requestCounter = (_requestCounter + 1) % 1_000_000;
  return `req_${Date.now().toString(36)}_${_requestCounter.toString(36)}`;
}

export interface LogContext {
  requestId: string;
  route: string;
  ip: string;
  durationMs?: number;
  status?: number;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/* Handler factory                                                             */
/* -------------------------------------------------------------------------- */

export type Source = 'query' | 'body';

export interface ApiHandlerOptions<TParams, TResult> {
  /** Short stable name for logging / cache namespacing (e.g. 'pools.list'). */
  name: string;
  /**
   * Zod schema. Pass `null` for routes with no input.
   * Loose-typed: Zod's input and output types differ when defaults are
   * present, so callers can use `ZodSchema<unknown>` or a strict typed schema.
   */
  schema: ZodSchema<TParams> | ZodSchema<unknown> | null;
  /** 'query' reads `nextUrl.searchParams`, 'body' reads JSON. Default 'query'. */
  source?: Source;
  /** TTL in ms; omit to disable caching. */
  cacheTtlMs?: number;
  /** Rate limit config; omit to disable. */
  rateLimit?: RateLimitConfig;
  /** Route handler. */
  handler: (ctx: { params: TParams; request: NextRequest; requestId: string }) => Promise<TResult>;
}

function parseInput<TParams>(
  request: NextRequest,
  schema: ZodSchema<TParams> | null,
  source: Source
): TParams {
  if (!schema) return undefined as unknown as TParams;
  if (source === 'body') {
    // Caller is responsible for awaiting the body via request.json()
    // We can't await here synchronously; we'll handle below.
    return undefined as unknown as TParams;
  }
  const obj: Record<string, unknown> = {};
  for (const [k, v] of request.nextUrl.searchParams.entries()) {
    // Heuristic: try to coerce numbers
    if (/^-?\d+(\.\d+)?$/.test(v)) {
      const n = Number(v);
      if (!Number.isNaN(n)) {
        obj[k] = n;
        continue;
      }
    }
    if (v === 'true') {
      obj[k] = true;
      continue;
    }
    if (v === 'false') {
      obj[k] = false;
      continue;
    }
    obj[k] = v;
  }
  return schema.parse(obj);
}

export function apiHandler<TParams = unknown, TResult = unknown>(
  opts: ApiHandlerOptions<TParams, TResult>
) {
  const source: Source = opts.source ?? 'query';

  return async function handle(request: NextRequest): Promise<NextResponse> {
    const requestId = nextRequestId();
    const ip = clientIp(request);
    const startedAt = Date.now();
    const logBase: LogContext = { requestId, route: opts.name, ip };

    let resultResponse: NextResponse | null = null;
    try {
      // --- rate limit ---
      if (opts.rateLimit) {
        const key = `${opts.name}:${ip}`;
        const rl = consume(key, opts.rateLimit);
        if (!rl.allowed) {
          const res = apiFail(429, {
            error: 'rate_limited',
            message: `Too many requests for ${opts.name}`,
            suggestion: `Retry after ${rl.retryAfterMs}ms`,
            requestId,
          });
          res.headers.set('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
          log({ ...logBase, status: 429, durationMs: Date.now() - startedAt });
          resultResponse = res;
          return res;
        }
      }

      // --- parse + validate ---
      let params: TParams;
      try {
        if (source === 'body') {
          const raw = await request.json().catch(() => ({}));
          if (!opts.schema) {
            params = raw as TParams;
          } else {
            params = (opts.schema as ZodSchema<TParams>).parse(raw);
          }
        } else {
          params = parseInput(request, opts.schema as ZodSchema<TParams> | null, source);
        }
      } catch (err) {
        if (err instanceof ZodError) {
          const res = apiFail(400, {
            error: 'invalid_request',
            message: 'Request did not match expected schema',
            details: err.flatten(),
            requestId,
          });
          log({ ...logBase, status: 400, durationMs: Date.now() - startedAt, error: 'zod' });
          resultResponse = res;
          return res;
        }
        const res = apiFail(400, {
          error: 'bad_request',
          message: err instanceof Error ? err.message : String(err),
          requestId,
        });
        log({ ...logBase, status: 400, durationMs: Date.now() - startedAt, error: 'parse' });
        resultResponse = res;
        return res;
      }

      // --- execute (with optional cache) ---
      try {
        const exec = () =>
          opts.handler({ params, request, requestId });

        const result = opts.cacheTtlMs
          ? await cached(opts.name, cacheKeyFromParams(params, request), opts.cacheTtlMs, exec)
          : await exec();

        const res = apiOk(result);
        res.headers.set('x-request-id', requestId);
        log({ ...logBase, status: 200, durationMs: Date.now() - startedAt });
        resultResponse = res;
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isClientError = /not.found|invalid|unsupported|not.found/i.test(message);
        const status = isClientError ? 404 : 500;
        const res = apiFail(status, {
          error: isClientError ? 'not_found' : 'internal_error',
          message,
          requestId,
          suggestion: isClientError
            ? 'Check inputs (chainId, addresses, poolId) and retry.'
            : 'Server error — please retry. Check /api/health for status.',
        });
        log({
          ...logBase,
          status,
          durationMs: Date.now() - startedAt,
          error: message.slice(0, 240),
        });
        resultResponse = res;
        return res;
      }
    } finally {
      // Always record metrics — even when an unexpected throw escapes
      // the handler. Cardinality is bounded (route + method + status_class
      // only), so this is safe at any request volume.
      if (resultResponse) {
        try {
          recordMetric(opts.name, request.method, resultResponse.status, Date.now() - startedAt);
        } catch {
          // Metrics must never break the response.
        }
      } else {
        try {
          recordMetric(opts.name, request.method, 500, Date.now() - startedAt);
        } catch {
          // ignore
        }
      }
    }
  };
}

function cacheKeyFromParams<TParams>(params: TParams, request: NextRequest): string {
  // For body-sourced requests, also fold the URL in to avoid cross-route cache
  // collisions if namespacing fails.
  const url = request.nextUrl.pathname + request.nextUrl.search;
  try {
    return `${url}::${JSON.stringify(params)}`;
  } catch {
    return `${url}::${Date.now()}`;
  }
}

function log(ctx: LogContext): void {
  const line = `[api] ${ctx.route} ${ctx.status ?? '???'} ${ctx.durationMs ?? '???'}ms req=${ctx.requestId} ip=${ctx.ip}${ctx.error ? ` err="${ctx.error}"` : ''}`;
  // eslint-disable-next-line no-console
  console.log(line);
}