/**
 * JSON helpers for Next.js route handlers.
 *
 * Solves two problems we hit during live-API testing:
 *
 *  1. `NextResponse.json(obj)` uses native `JSON.stringify`, which throws
 *     on `BigInt` (TypeError: Do not know how to serialize a BigInt).
 *     Position / liquidity values from the on-chain RPC are bigints —
 *     spreading them into the response shape crashes the handler.
 *     This helper converts bigints to their decimal-string form before
 *     serializing (safe for the consumer; JSON.parse restores them via
 *     `BigInt(str)`).
 *
 *  2. Malformed JSON bodies currently surface as 500s because the
 *     route's `try/catch` lumps zod parse errors and JSON syntax errors
 *     into the same 500 path. `safeJson(request)` parses the body
 *     safely and returns either `{ ok: true, value }` or a typed 400
 *     Response the caller can short-circuit with.
 */

import { NextResponse } from 'next/server';

const BIGINT_PLACEHOLDER = '__bigint__';
// `JSON.stringify` cannot serialise BigInt directly. The custom replacer
// emits `"12345n"` for bigints — not standard JSON, but our consumer is
// always our own SDK / front-end which knows to `BigInt(str.slice(0,-1))`.
// (We could also emit numeric strings: `"12345"`. Either is round-trippable;
// numeric strings are easier to consume.)
function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/**
 * Like `NextResponse.json` but safe for `bigint` values anywhere in the
 * payload tree. Optionally returns the parsed body alongside when the
 * caller wants both.
 */
export function jsonResponse(
  payload: unknown,
  init?: ResponseInit,
): NextResponse {
  const body = JSON.stringify(payload, bigintReplacer);
  return new NextResponse(body, {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

export interface JsonParseOk<T> {
  ok: true;
  value: T;
}
export interface JsonParseErr {
  ok: false;
  response: NextResponse;
}

/**
 * Read and JSON-parse a request body without throwing. On success returns
 * the parsed value. On failure returns a 400 Response shaped like the
 * project's standard error envelope so the caller can `return` it
 * directly.
 */
export async function safeJson<T = unknown>(request: Request): Promise<JsonParseOk<T> | JsonParseErr> {
  const raw = await request.text();
  if (raw.length === 0) {
    return {
      ok: false,
      response: jsonResponse(
        {
          error: 'invalid_request',
          message: 'Request body is empty',
          suggestion: 'POST a JSON body with the required fields.',
          requestId: getRequestIdFromHeaders(request.headers),
        },
        { status: 400 },
      ),
    };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      response: jsonResponse(
        {
          error: 'invalid_request',
          message: 'Malformed JSON body',
          details: { parser: message },
          suggestion: 'Check the JSON body for missing/extra commas, unmatched braces, or invalid escapes.',
          requestId: getRequestIdFromHeaders(request.headers),
        },
        { status: 400 },
      ),
    };
  }
}

/**
 * Pull the `x-request-id` request header (set by our middleware / by
 * the edge) so error envelopes can echo it back. Falls back to a fresh
 * crypto-derived id if absent.
 */
function getRequestIdFromHeaders(headers: Headers): string {
  const existing = headers.get('x-request-id');
  if (existing) return existing;
  return `req_${Math.random().toString(36).slice(2, 12)}`;
}