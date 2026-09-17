/**
 * OpenAPI 3.1 spec builder for the UniV3 Strategy Lab API surface.
 *
 * This module owns the static part of the spec (info, servers, tags, the
 * `/api/openapi.json` route metadata) and assembles `paths` /
 * `components.schemas` from:
 *
 *   - `route-inventory.ts` — every documented route, with paths + responses
 *   - `schemas.ts`          — the in-memory registry of named JSON Schemas
 *     populated by `route-inventory.ts` via `registerSchema()` and `zodRef()`
 *
 * Adding a route is a two-step ritual:
 *   1. Append a `RouteEntry` to `ROUTE_INVENTORY`
 *   2. Add a coverage assertion to `tests/openapi.test.ts`
 *
 * No other file in `lib/api/openapi/` needs to change.
 */

import { ROUTE_INVENTORY } from './route-inventory';
import type { OpenApiParameter } from './route-inventory';
import { listSchemas } from './schemas';

const API_VERSION = '0.1.0';
const API_TITLE = 'UniV3 Strategy Lab API';

/* -------------------------------------------------------------------------- */
/* Tag catalogue                                                                */
/* -------------------------------------------------------------------------- */

const TAGS = [
  {
    name: 'health',
    description:
      'Liveness + dependency smoke checks. The endpoint always returns HTTP 200; check `status` and `checks[]` for the real signal.',
  },
  {
    name: 'metrics',
    description:
      'Prometheus text exposition. NOT JSON — content-type is `text/plain; version=0.0.4`.',
  },
  {
    name: 'backtests',
    description:
      'Historical backtest engine — synthetic-data backtests, opt-in real-data backtests (DeFi Llama + CoinGecko), confidence bands, and pre-deposit red-flag checklists.',
  },
  {
    name: 'risk',
    description:
      'Risk analytics computed over any equity curve — Sharpe / Sortino / Calmar / VaR / CVaR / Ulcer / Burke.',
  },
  {
    name: 'pools',
    description:
      'Pool discovery + per-pool details. V3 today; V4 pools live under the `v4` tag.',
  },
  {
    name: 'simulations',
    description:
      'Deterministic scenario simulation — runs an LP vs HODL grid at min/base/max volume.',
  },
  {
    name: 'v4',
    description: 'Uniswap V4 surface: pool discovery, hook-aware simulate, hook registry, hook recommendations.',
  },
  {
    name: 'wallet',
    description: 'Wallet position tracking + per-position analytics.',
  },
];

/* -------------------------------------------------------------------------- */
/* Path builder                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Translate a `RouteEntry` into the OpenAPI path-item shape.
 *
 * OpenAPI uses lowercase HTTP methods as keys (`get`, `post`, …) and
 * `parameters` is an array shared across the whole path-item — so we hoist
 * `pathParams` into the shared bucket and prefix them under the `in: 'path'`
 * discriminator. We also expand `{ $ref }` query parameters into the
 * shared parameters array.
 */
function buildOperation(route: (typeof ROUTE_INVENTORY)[number]): {
  parameters: OpenApiParameter[];
  operation: Record<string, unknown>;
} {
  const parameters: OpenApiParameter[] = [...(route.pathParams ?? [])];

  for (const q of route.queryParams ?? []) {
    // Strip the `{$ref}` wrapper and convert to a parameter object.
    // Query parameters are referenced by `$ref` to a `components.schemas`
    // entry that represents the *object* — but OpenAPI parameters need an
    // object with `in: 'query'` / `schema: {type: 'string'}`. We expand
    // the referenced schema's `properties` into individual parameters.
    const ref = (q as { $ref?: string }).$ref;
    if (typeof ref === 'string') {
      const refName = ref.replace('#/components/schemas/', '');
      const schemas = listSchemas();
      const refSchema = schemas[refName];
      if (refSchema?.type === 'object' && refSchema.properties) {
        const required = new Set(
          Array.isArray(refSchema.required) ? (refSchema.required as string[]) : [],
        );
        for (const [propName, propSchema] of Object.entries(
          refSchema.properties as Record<string, Record<string, unknown>>,
        )) {
          parameters.push({
            name: propName,
            in: 'query',
            required: required.has(propName),
            schema: propSchema,
            description: propSchema.description,
          });
        }
        continue;
      }
    }
    // Already-shaped parameter — pass through.
    parameters.push(q);
  }

  const operation: Record<string, unknown> = {
    operationId: route.operationId,
    summary: route.summary,
    description: route.description,
    tags: [route.tag],
    responses: route.responses,
  };

  if (parameters.length > 0) operation.parameters = parameters;
  if (route.requestBodySchema) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: route.requestBodySchema,
        },
      },
    };
  }

  return { parameters, operation };
}

function buildPaths(): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const route of ROUTE_INVENTORY) {
    const item: Record<string, unknown> = out[route.path] ?? {};
    const { operation } = buildOperation(route);
    item[route.method.toLowerCase()] = operation;
    out[route.path] = item;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Spec assembly                                                               */
/* -------------------------------------------------------------------------- */

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: API_TITLE,
    version: API_VERSION,
    summary: 'LP strategy lab API surface — V3 + V4 simulation, backtest, risk.',
    description: [
      'OpenAPI 3.1 contract for the UniV3 Strategy Lab HTTP API.',
      '',
      '**Stability**: this spec is the machine-readable source of truth for SDK',
      'generation, mock servers, and request validation. It is hand-maintained',
      'in `lib/api/openapi/route-inventory.ts` and references the live Zod',
      'schemas so the spec cannot drift from runtime validation.',
      '',
      '**Coverage**: every route under `app/api/**/route.ts` that is wired',
      'through the inventory is documented. The list is asserted by',
      '`tests/openapi.test.ts` so adding a route without updating the spec',
      'breaks CI.',
    ].join('\n'),
    contact: {
      name: 'UniV3 Strategy Lab maintainers',
      url: 'https://github.com/qscreen/ticklab',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://app.ticklab.com',
      description: 'Production (placeholder — update before public release)',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
  ],
  tags: TAGS,
  paths: buildPaths(),
  components: {
    schemas: {
      ...listSchemas(),
      ApiError: {
        type: 'object',
        description: 'Standard error envelope returned by every API route.',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          details: {},
          suggestion: { type: 'string' },
          requestId: { type: 'string', pattern: '^req_[A-Za-z0-9_]+$' },
        },
        required: ['error'],
        additionalProperties: true,
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid request — zod validation failed or required parameters missing.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found (pool, position, token).',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      TooManyRequests: {
        description: 'Rate limit exceeded.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      InternalServerError: {
        description: 'Server error.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    },
  },
} as const;

/**
 * Return the spec as a plain object. Pulled out so consumers (route
 * handler + tests) can request it on demand without dealing with `as const`
 * tuple types.
 */
export function buildSpec(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(OPENAPI_SPEC)) as Record<string, unknown>;
}