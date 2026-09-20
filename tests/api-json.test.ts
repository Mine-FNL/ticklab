/**
 * Tests for `lib/api/json` — the BigInt-safe response helper and the
 * `safeJson` request body parser.
 *
 * Both exist because:
 *   - native `JSON.stringify` throws on `bigint` (TypeError), and several
 *     routes spread on-chain position objects that contain bigints
 *     (`liquidity`, `tokensOwed0/1`, `feeGrowthInside0/1LastX128`) into
 *     the response — which crashed `/api/wallet/positions` with a
 *     `Do not know how to serialize a BigInt` 500.
 *   - malformed JSON bodies used to surface as 500s because the route's
 *     `try/catch` lumped zod errors and JSON syntax errors together.
 *     `safeJson` separates them and emits the project's standard 400
 *     envelope with a helpful suggestion.
 */

import { describe, expect, it } from 'vitest';

import { jsonResponse, safeJson } from '../lib/api/json';

// ---------------------------------------------------------------------------
// 1. jsonResponse — BigInt-safe serialisation
// ---------------------------------------------------------------------------

describe('jsonResponse — bigint handling', () => {
  it('serialises a flat bigint without throwing', async () => {
    const res = jsonResponse({ liquidity: 12345n });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('{"liquidity":"12345"}');
  });

  it('serialises bigints nested inside objects and arrays', async () => {
    const res = jsonResponse({
      positions: [{ liquidity: 1n, tokensOwed0: 2n }, { liquidity: 3n }],
      summary: { count: 2 },
    });
    const text = await res.text();
    const parsed = JSON.parse(text);
    expect(parsed.positions[0].liquidity).toBe('1');
    expect(parsed.positions[1].tokensOwed0).toBeUndefined();
    expect(parsed.summary.count).toBe(2);
  });

  it('passes through regular JSON values unchanged', async () => {
    const res = jsonResponse({ ok: true, value: 1.5, name: 'foo', arr: [1, 2, 3] });
    const text = await res.text();
    expect(text).toBe('{"ok":true,"value":1.5,"name":"foo","arr":[1,2,3]}');
  });

  it('accepts an init object for status code + headers', async () => {
    const res = jsonResponse({ error: 'x' }, { status: 400, headers: { 'x-test': '1' } });
    expect(res.status).toBe(400);
    expect(res.headers.get('x-test')).toBe('1');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

// ---------------------------------------------------------------------------
// 2. safeJson — malformed-body handling
// ---------------------------------------------------------------------------

function makeRequest(body: string, contentType = 'application/json'): Request {
  return new Request('https://example.com/test', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}

describe('safeJson — malformed-body handling', () => {
  it('returns the parsed value on well-formed JSON', async () => {
    const out = await safeJson<{ a: number }>(makeRequest('{"a":1}'));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.a).toBe(1);
  });

  it('returns a typed 400 envelope on malformed JSON, not a thrown error', async () => {
    const out = await safeJson(makeRequest('{bad'));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.response.status).toBe(400);
      const body = await out.response.json();
      expect(body.error).toBe('invalid_request');
      expect(body.message).toBe('Malformed JSON body');
      expect(body.details.parser).toBeTruthy();
      expect(body.suggestion).toBeTruthy();
      expect(body.requestId).toMatch(/^req_/);
    }
  });

  it('returns a typed 400 envelope on empty body', async () => {
    const out = await safeJson(makeRequest(''));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.response.status).toBe(400);
      const body = await out.response.json();
      expect(body.message).toBe('Request body is empty');
    }
  });

  it('preserves x-request-id header when present', async () => {
    const req = new Request('https://example.com/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req_myid_42' },
      body: '{bad',
    });
    const out = await safeJson(req);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      const body = await out.response.json();
      expect(body.requestId).toBe('req_myid_42');
    }
  });
});