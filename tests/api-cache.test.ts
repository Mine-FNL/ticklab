/**
 * API cache + rate limit unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { cached, invalidate, size } from '../lib/api/cache';
import { consume, clientIp, RateLimitPresets } from '../lib/api/rate-limit';

describe('cached', () => {
  beforeEach(() => invalidate('test-ns'));

  it('returns loader value on miss and caches it', async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return 'value';
    };
    const a = await cached('test-ns', 'k', 60_000, loader);
    const b = await cached('test-ns', 'k', 60_000, loader);
    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(calls).toBe(1);
  });

  it('respects TTL — re-loads after expiry', async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return calls;
    };
    const a = await cached('test-ns', 'k', 1, loader);
    await new Promise((r) => setTimeout(r, 10));
    const b = await cached('test-ns', 'k', 1, loader);
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it('invalidate clears namespace', async () => {
    await cached('test-ns', 'a', 60_000, async () => 1);
    await cached('test-ns', 'b', 60_000, async () => 2);
    expect(size('test-ns')).toBe(2);
    invalidate('test-ns');
    expect(size('test-ns')).toBe(0);
  });
});

describe('consume (rate limit)', () => {
  it('allows up to capacity then 429s', () => {
    const cfg = { capacity: 3, refillPerMs: 0 }; // no refill
    const r1 = consume('user-1', cfg);
    const r2 = consume('user-1', cfg);
    const r3 = consume('user-1', cfg);
    const r4 = consume('user-1', cfg);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  it('buckets are isolated per key', () => {
    const cfg = { capacity: 1, refillPerMs: 0 };
    expect(consume('a', cfg).allowed).toBe(true);
    expect(consume('a', cfg).allowed).toBe(false);
    expect(consume('b', cfg).allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('returns x-forwarded-for first hop', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' });
    expect(clientIp({ headers })).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '5.6.7.8' });
    expect(clientIp({ headers })).toBe('5.6.7.8');
  });

  it('returns unknown when no headers present', () => {
    expect(clientIp({ headers: new Headers() })).toBe('unknown');
  });
});

describe('RateLimitPresets', () => {
  it('exposes read, compute, discover presets with positive capacity', () => {
    for (const k of Object.keys(RateLimitPresets) as Array<keyof typeof RateLimitPresets>) {
      expect(RateLimitPresets[k].capacity).toBeGreaterThan(0);
      expect(RateLimitPresets[k].refillPerMs).toBeGreaterThan(0);
    }
  });
});