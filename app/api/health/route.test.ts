/**
 * Integration test for GET /api/health.
 *
 * Strategy: import the exported `GET` handler and invoke it with a fake
 * NextRequest. Stub the global `fetch` so we can simulate upstream behaviour
 * deterministically and avoid real network calls during CI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GET } from './route';
import type { HealthReport } from './route';

const PKG_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string };
    return pkg.version;
  } catch {
    return '0.1.0';
  }
})();

function makeRequest(): NextRequest {
  return new NextRequest(new Request('http://localhost/api/health', { method: 'GET' }));
}

async function callHandler(): Promise<HealthReport> {
  const res = await (GET as unknown as (req: NextRequest) => Promise<Response>)(makeRequest());
  return (await res.json()) as HealthReport;
}

interface FetchStub {
  url: string;
  status: number;
  ok: boolean;
  delayMs?: number;
}

function stubFetch(stubs: FetchStub[]): void {
  const queue = [...stubs];
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const next = queue.shift();
    if (!next) {
      throw new Error(`Unexpected fetch call to ${url}`);
    }
    if (next.delayMs) {
      await new Promise((r) => setTimeout(r, next.delayMs));
    }
    if (!next.ok) {
      throw new Error(`network down for ${next.url}`);
    }
    return new Response('', { status: next.status });
  }) as unknown as typeof fetch;
}

describe('GET /api/health', () => {
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_BUILD_SHA = process.env.BUILD_SHA;
  const ORIGINAL_PKG_VERSION = process.env.npm_package_version;

  beforeEach(() => {
    delete process.env.BUILD_SHA;
    // `npm run test` does not always inject npm_package_version — set it so
    // version reporting matches CI behaviour.
    process.env.npm_package_version = PKG_VERSION;
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_BUILD_SHA === undefined) delete process.env.BUILD_SHA;
    else process.env.BUILD_SHA = ORIGINAL_BUILD_SHA;
    if (ORIGINAL_PKG_VERSION === undefined) delete process.env.npm_package_version;
    else process.env.npm_package_version = ORIGINAL_PKG_VERSION;
  });

  it('returns status:ok when all upstreams return 200', async () => {
    stubFetch([
      { url: 'llama', status: 200, ok: true },
      { url: 'binance', status: 200, ok: true },
      { url: 'rpc', status: 200, ok: true },
    ]);

    const body = await callHandler();
    expect(body.status).toBe('ok');
    expect(body.checks).toHaveLength(3);
    expect(body.checks.every((c) => c.ok)).toBe(true);
    expect(body.checks.map((c) => c.name)).toEqual(['defillama', 'binance', 'rpc']);
  });

  it('returns status:degraded when any upstream fails', async () => {
    stubFetch([
      { url: 'llama', status: 200, ok: true },
      { url: 'binance', status: 500, ok: true },
      { url: 'rpc', status: 200, ok: true },
    ]);

    const body = await callHandler();
    expect(body.status).toBe('degraded');
    const binance = body.checks.find((c) => c.name === 'binance');
    expect(binance?.ok).toBe(false);
    expect(binance?.error).toContain('HTTP 500');
  });

  it('treats network errors as a failed check', async () => {
    stubFetch([
      { url: 'llama', status: 200, ok: true },
      { url: 'binance', status: 0, ok: false }, // throws
      { url: 'rpc', status: 200, ok: true },
    ]);

    const body = await callHandler();
    expect(body.status).toBe('degraded');
    const binance = body.checks.find((c) => c.name === 'binance');
    expect(binance?.ok).toBe(false);
    expect(binance?.error).toMatch(/network down/);
  });

  it('version matches package.json', async () => {
    stubFetch([
      { url: 'llama', status: 200, ok: true },
      { url: 'binance', status: 200, ok: true },
      { url: 'rpc', status: 200, ok: true },
    ]);

    const body = await callHandler();
    expect(body.version).toBe(PKG_VERSION);
  });

  it("buildSha reads from process.env.BUILD_SHA or 'unknown'", async () => {
    delete process.env.BUILD_SHA;
    stubFetch([
      { url: 'llama', status: 200, ok: true },
      { url: 'binance', status: 200, ok: true },
      { url: 'rpc', status: 200, ok: true },
    ]);
    let body = await callHandler();
    expect(body.buildSha).toBe('unknown');

    process.env.BUILD_SHA = 'abc1234';
    stubFetch([
      { url: 'llama', status: 200, ok: true },
      { url: 'binance', status: 200, ok: true },
      { url: 'rpc', status: 200, ok: true },
    ]);
    body = await callHandler();
    expect(body.buildSha).toBe('abc1234');
  });

  it('uptime is a non-negative number', async () => {
    stubFetch([
      { url: 'llama', status: 200, ok: true },
      { url: 'binance', status: 200, ok: true },
      { url: 'rpc', status: 200, ok: true },
    ]);

    const body = await callHandler();
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    // uptimeSeconds is the rounded integer mirror for back-compat
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('preserves back-compat fields (service, timestamp, node)', async () => {
    stubFetch([
      { url: 'llama', status: 200, ok: true },
      { url: 'binance', status: 200, ok: true },
      { url: 'rpc', status: 200, ok: true },
    ]);

    const body = await callHandler();
    expect(body.service).toBe('ticklab');
    expect(body.timestamp).toMatch(/T.+Z$/);
    expect(body.node).toMatch(/^v\d+\./);
  });
});
