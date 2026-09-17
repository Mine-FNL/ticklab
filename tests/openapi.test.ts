/**
 * OpenAPI 3.1 spec coverage tests.
 *
 * These tests pin the spec to the inventory and to the runtime route
 * handler. A new route in `app/api/` without a matching entry in
 * `ROUTE_INVENTORY` will not break these tests directly — but the
 * inventory-driven assertions below will fail loudly when somebody edits
 * one without the other.
 */

import { describe, it, expect } from 'vitest';

import { buildSpec, OPENAPI_SPEC } from '../lib/api/openapi/spec';
import { ROUTE_INVENTORY, ROUTE_INDEX } from '../lib/api/openapi/route-inventory';
import { GET } from '../app/api/openapi.json/route';

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`expected object, got ${typeof value}`);
  }
  return value as Record<string, unknown>;
}

function asSpec(value: unknown): {
  openapi: string;
  info: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
} {
  const obj = asRecord(value);
  return {
    openapi: String(obj.openapi),
    info: asRecord(obj.info),
    paths: asRecord(obj.paths) as Record<string, Record<string, unknown>>,
    components: asRecord(obj.components) as {
      schemas: Record<string, unknown>;
    },
  };
}

describe('OpenAPI spec', () => {
  it('returns an object with openapi === "3.1.0"', () => {
    const spec = asSpec(buildSpec());
    expect(spec.openapi).toBe('3.1.0');
  });

  it('exposes the expected top-level shape', () => {
    const spec = asSpec(buildSpec());
    expect(spec.info.title).toBeTruthy();
    expect(spec.info.version).toBeTruthy();
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    expect(Object.keys(spec.components.schemas).length).toBeGreaterThan(0);
  });

  it('every route in the inventory has an entry under paths with the documented method', () => {
    const spec = asSpec(buildSpec());
    for (const route of ROUTE_INVENTORY) {
      const pathItem = spec.paths[route.path];
      expect(pathItem, `missing path entry: ${route.path}`).toBeTruthy();
      const op = pathItem[route.method.toLowerCase()];
      expect(op, `missing ${route.method} on ${route.path}`).toBeTruthy();
      expect(asRecord(op).operationId).toBe(route.operationId);
    }
  });

  it('every inventory entry is reachable from the ROUTE_INDEX', () => {
    for (const route of ROUTE_INVENTORY) {
      const key = `${route.method} ${route.path}`;
      expect(ROUTE_INDEX.get(key), `index missing ${key}`).toBeDefined();
    }
  });

  it('the /api/health response schema is documented', () => {
    const spec = asSpec(buildSpec());
    const pathItem = spec.paths['/api/health'];
    expect(pathItem).toBeTruthy();
    const get = asRecord(pathItem.get);
    const responses = asRecord(get.responses);
    const ok = asRecord(responses['200']);
    const content = asRecord(ok.content);
    const json = asRecord(content['application/json']);
    const schema = json.schema as Record<string, unknown>;
    expect(schema.$ref).toBe('#/components/schemas/HealthReport');
    expect(spec.components.schemas.HealthReport).toBeTruthy();
  });

  it('covers at least the documented route count', () => {
    // Sanity floor — current inventory has 16 entries.
    expect(ROUTE_INVENTORY.length).toBeGreaterThanOrEqual(13);
  });

  it('OPENAPI_SPEC and buildSpec() agree', () => {
    const a = asSpec(OPENAPI_SPEC);
    const b = asSpec(buildSpec());
    expect(a.openapi).toBe(b.openapi);
    expect(Object.keys(a.paths).sort()).toEqual(Object.keys(b.paths).sort());
  });

  it('documents /api/metrics as text/plain (not JSON)', () => {
    const spec = asSpec(buildSpec());
    const op = asRecord(asRecord(spec.paths['/api/metrics']).get);
    const ok = asRecord(asRecord(op.responses)['200']);
    const content = asRecord(ok.content);
    expect(content['text/plain']).toBeTruthy();
    expect(content['application/json']).toBeUndefined();
  });

  it('every path method has an operationId, summary, and at least one response', () => {
    const spec = asSpec(buildSpec());
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const [method, opRaw] of Object.entries(item)) {
        if (method.startsWith('$') || method === 'parameters') continue;
        const op = asRecord(opRaw);
        expect(op.operationId, `${method} ${path} missing operationId`).toBeTruthy();
        expect(op.summary, `${method} ${path} missing summary`).toBeTruthy();
        const responses = asRecord(op.responses);
        expect(Object.keys(responses).length, `${method} ${path} has no responses`).toBeGreaterThan(0);
      }
    }
  });
});

describe('GET /api/openapi.json', () => {
  it('returns 200 with Content-Type: application/json', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
    // Make sure the body parses as JSON and the spec looks like a spec.
    const parsed = JSON.parse(body) as Record<string, unknown>;
    expect(parsed.openapi).toBe('3.1.0');
    expect(parsed.paths).toBeTruthy();
    expect(parsed.components).toBeTruthy();
  });

  it('returns a body that contains every inventory path', async () => {
    const res = await GET();
    const body = JSON.parse(await res.text()) as Record<string, unknown>;
    const paths = asRecord(body.paths);
    for (const route of ROUTE_INVENTORY) {
      expect(paths[route.path], `${route.path} missing from spec`).toBeTruthy();
    }
  });
});