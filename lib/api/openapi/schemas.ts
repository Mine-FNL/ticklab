/**
 * OpenAPI 3.1 schema helpers.
 *
 * Two responsibilities:
 *
 *   1. `zodToJsonSchema` — minimal zod → JSON Schema converter so the spec
 *      can reference request bodies / query params by their runtime Zod
 *      schemas. Implemented in-tree to avoid pulling `zod-to-json-schema`
 *      (not in `package.json`) — we only need the subset our routes use.
 *
 *   2. Manual JSON Schema definitions for shapes that aren't surfaced by a
 *      zod schema (e.g. response envelopes, the Prometheus exposition for
 *      `/api/metrics`, the V4 pool discovery response, the wallet-positions
 *      response). These are hand-maintained and named in `SPEC_SCHEMAS` so
 *      they're addressable from `paths`.
 *
 * Everything is exported as plain JSON-Schema-compatible objects so the
 * final spec is plain JSON at runtime — no zod type leakage into
 * `components.schemas`.
 */

import { z } from 'zod';

/**
 * ZodFirstPartyTypeKind values used by the route inventory.
 *
 * String literals rather than the enum so we don't have to dig into
 * zod's internal subpath (`zod/v3/types`), which isn't part of the
 * package's public export map in this version of zod. `def.typeName`
 * is a string under the hood, so the equality check works identically.
 */
const ZK = {
  ZodString: 'ZodString',
  ZodNumber: 'ZodNumber',
  ZodNaN: 'ZodNaN',
  ZodBigInt: 'ZodBigInt',
  ZodBoolean: 'ZodBoolean',
  ZodDate: 'ZodDate',
  ZodSymbol: 'ZodSymbol',
  ZodUndefined: 'ZodUndefined',
  ZodNull: 'ZodNull',
  ZodAny: 'ZodAny',
  ZodUnknown: 'ZodUnknown',
  ZodNever: 'ZodNever',
  ZodVoid: 'ZodVoid',
  ZodArray: 'ZodArray',
  ZodObject: 'ZodObject',
  ZodUnion: 'ZodUnion',
  ZodDiscriminatedUnion: 'ZodDiscriminatedUnion',
  ZodIntersection: 'ZodIntersection',
  ZodTuple: 'ZodTuple',
  ZodRecord: 'ZodRecord',
  ZodMap: 'ZodMap',
  ZodSet: 'ZodSet',
  ZodFunction: 'ZodFunction',
  ZodLazy: 'ZodLazy',
  ZodLiteral: 'ZodLiteral',
  ZodEnum: 'ZodEnum',
  ZodEffects: 'ZodEffects',
  ZodNativeEnum: 'ZodNativeEnum',
  ZodOptional: 'ZodOptional',
  ZodNullable: 'ZodNullable',
  ZodDefault: 'ZodDefault',
  ZodCatch: 'ZodCatch',
  ZodPromise: 'ZodPromise',
  ZodBranded: 'ZodBranded',
} as const;

type ZodNodeType =
  | 'ZodString'
  | 'ZodNumber'
  | 'ZodNaN'
  | 'ZodBigInt'
  | 'ZodBoolean'
  | 'ZodDate'
  | 'ZodSymbol'
  | 'ZodUndefined'
  | 'ZodNull'
  | 'ZodAny'
  | 'ZodUnknown'
  | 'ZodNever'
  | 'ZodVoid'
  | 'ZodArray'
  | 'ZodObject'
  | 'ZodUnion'
  | 'ZodDiscriminatedUnion'
  | 'ZodIntersection'
  | 'ZodTuple'
  | 'ZodRecord'
  | 'ZodMap'
  | 'ZodSet'
  | 'ZodFunction'
  | 'ZodLazy'
  | 'ZodLiteral'
  | 'ZodEnum'
  | 'ZodEffects'
  | 'ZodNativeEnum'
  | 'ZodOptional'
  | 'ZodNullable'
  | 'ZodDefault'
  | 'ZodCatch'
  | 'ZodPromise'
  | 'ZodBranded';

/* -------------------------------------------------------------------------- */
/* JSON Schema building blocks                                                 */
/* -------------------------------------------------------------------------- */

/** OpenAPI/JSON-Schema dialect marker (we target Draft 2020-12 via 3.1). */
export const SCHEMA_DIALECT = 'jsonSchema' as const;

export interface JsonSchema {
  [key: string]: unknown;
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  const?: unknown;
  nullable?: boolean;
  description?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema | JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;
  $ref?: string;
}

/* -------------------------------------------------------------------------- */
/* Shared schema fragments                                                     */
/* -------------------------------------------------------------------------- */

/** 0x-prefixed 20-byte Ethereum address. */
export const ETH_ADDRESS_PATTERN = '^0x[a-fA-F0-9]{40}$';

export const EthereumAddressSchema: JsonSchema = {
  type: 'string',
  pattern: ETH_ADDRESS_PATTERN,
  description: '0x-prefixed 20-byte Ethereum address.',
  examples: [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  ],
};

/** A chain ID — positive integer. EVM chain IDs are widely understood. */
export const ChainIdSchema: JsonSchema = {
  type: 'integer',
  minimum: 1,
  description: 'EVM chain ID (1 = Ethereum mainnet, 42161 = Arbitrum, etc.).',
  default: 1,
  examples: [1, 42161, 8453, 10, 137],
};

/* -------------------------------------------------------------------------- */
/* Common response envelopes                                                   */
/* -------------------------------------------------------------------------- */

export const ApiErrorSchema: JsonSchema = {
  type: 'object',
  description: 'Standard error envelope returned by every API route.',
  properties: {
    error: { type: 'string', description: 'Machine-readable error code.' },
    message: { type: 'string', description: 'Human-readable error message.' },
    details: {
      description:
        'Optional details — typically a ZodError.flatten() payload for validation failures.',
    },
    suggestion: {
      type: 'string',
      description: 'Actionable suggestion for the caller.',
    },
    requestId: {
      type: 'string',
      pattern: '^req_[A-Za-z0-9_]+$',
      description: 'Server-generated request ID for log correlation.',
    },
  },
  required: ['error'],
  additionalProperties: true,
};

export const WarningSchema: JsonSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', description: 'Warning category code.' },
    severity: {
      type: 'string',
      enum: ['info', 'warning', 'error', 'critical'],
      description: 'Severity of the warning.',
    },
    message: { type: 'string' },
    recommendation: { type: 'string' },
  },
  required: ['type', 'message'],
  additionalProperties: true,
};

/* -------------------------------------------------------------------------- */
/* Zod → JSON Schema converter                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Convert a Zod schema into a JSON Schema 2020-12 fragment suitable for
 * embedding under `components.schemas` / `paths.*.requestBody.content`.
 *
 * Only the zod node types our routes actually use are handled. New types
 * can be added incrementally as the surface grows; everything else throws
 * a helpful error.
 *
 * The converter unwraps the wrapper chain (optional/nullable/default)
 * BEFORE applying `type`, so a `z.string().optional()` yields `{type:'string'}`
 * plus the parent `required: false` (handled by `objectOf`). A `nullable`
 * wrapper sets `nullable: true` instead of using `type: ['string','null']`
 * so we stay within the OpenAPI 3.1 / JSON Schema 2020-12 dialect.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  return convert(schema);
}

function convert(schema: z.ZodTypeAny): JsonSchema {
  let node = schema;
  let nullable = false;
  const descriptionParts: string[] = [];
  const def: Array<{ node: z.ZodTypeAny; description?: string }> = [];

  // Unwrap description wrapper chain first so description applies to the
  // resolved type, not to the wrapper.
  while (
    node._def?.typeName === ZK.ZodOptional ||
    node._def?.typeName === ZK.ZodNullable
  ) {
    if (node._def.typeName === ZK.ZodNullable) nullable = true;
    if (typeof node._def?.description === 'string') descriptionParts.push(node._def.description);
    node = (node._def as { innerType: z.ZodTypeAny }).innerType;
  }

  // Default wrapper — capture the default and continue into the inner type.
  let defaultValue: unknown;
  if (node._def?.typeName === ZK.ZodDefault) {
    const defObj = node._def as { defaultValue: () => unknown; innerType: z.ZodTypeAny };
    defaultValue = defObj.defaultValue();
    node = defObj.innerType;
    if (typeof node._def?.description === 'string') descriptionParts.push(node._def.description);
  }

  // Catch wrapper — same shape as default for our purposes.
  if (node._def?.typeName === ZK.ZodCatch) {
    const catchObj = node._def as { innerType: z.ZodTypeAny };
    node = catchObj.innerType;
  }

  if (typeof node._def?.description === 'string') {
    descriptionParts.push(node._def.description);
  }

  const out = convertCore(node);
  if (nullable) out.nullable = true;
  if (defaultValue !== undefined) out.default = defaultValue;
  if (descriptionParts.length > 0) out.description = descriptionParts.join(' ');
  return out;
}

function convertCore(schema: z.ZodTypeAny): JsonSchema {
  const def = schema._def;
  const typeName = def?.typeName as ZodNodeType | undefined;

  switch (typeName) {
    case ZK.ZodString: {
      const d = def as {
        checks?: Array<{ kind: string; value?: number; regex?: RegExp }>;
        isUUID?: boolean;
        format?: string;
      };
      const out: JsonSchema = { type: 'string' };
      for (const check of d.checks ?? []) {
        if (check.kind === 'min') out.minLength = check.value;
        if (check.kind === 'max') out.maxLength = check.value;
        if (check.kind === 'regex') {
          out.pattern = check.regex?.source;
        }
        if (check.kind === 'email') out.format = 'email';
        if (check.kind === 'url') out.format = 'uri';
        if (check.kind === 'uuid') out.format = 'uuid';
        if (check.kind === 'cuid') out.format = 'cuid';
      }
      return out;
    }

    case ZK.ZodNumber: {
      const d = def as {
        checks?: Array<{ kind: string; value?: number; inclusive?: boolean }>;
      };
      const out: JsonSchema = { type: 'number' };
      for (const check of d.checks ?? []) {
        if (check.kind === 'min') {
          if (check.inclusive === false) out.exclusiveMinimum = check.value;
          else out.minimum = check.value;
        }
        if (check.kind === 'max') {
          if (check.inclusive === false) out.exclusiveMaximum = check.value;
          else out.maximum = check.value;
        }
        if (check.kind === 'int') out.type = 'integer';
        if (check.kind === 'multipleOf') {
          // OpenAPI 3.1 supports `multipleOf` directly.
          (out as Record<string, unknown>).multipleOf = check.value;
        }
      }
      return out;
    }

    case ZK.ZodBigInt: {
      // JSON has no native bigint — OpenAPI models them as strings with a
      // pattern. Document that conversion requirement explicitly.
      return {
        type: 'string',
        pattern: '^-?[0-9]+$',
        description:
          'JSON has no native bigint — pass the value as a decimal string. The server will coerce.',
      };
    }

    case ZK.ZodBoolean: {
      return { type: 'boolean' };
    }

    case ZK.ZodNull: {
      return { type: 'null' };
    }

    case ZK.ZodLiteral: {
      const d = def as { value: unknown };
      return { const: d.value };
    }

    case ZK.ZodEnum:
    case ZK.ZodNativeEnum: {
      const d = def as { values?: Record<string, unknown>; options?: ReadonlyArray<unknown> };
      let values: unknown[];
      if (Array.isArray(d.options)) values = [...d.options];
      else values = d.values ? Object.values(d.values) : [];
      // Strip undefined entries that some zod enum shapes include.
      values = values.filter((v) => v !== undefined);
      return { type: 'string', enum: values };
    }

    case ZK.ZodArray: {
      const d = def as { type: z.ZodTypeAny; minLength?: { value: number }; maxLength?: { value: number } };
      const out: JsonSchema = {
        type: 'array',
        items: convert(d.type),
      };
      if (d.minLength?.value !== undefined) out.minItems = d.minLength.value;
      if (d.maxLength?.value !== undefined) out.maxItems = d.maxLength.value;
      return out;
    }

    case ZK.ZodObject: {
      const d = def as {
        shape: () => Record<string, z.ZodTypeAny>;
        unknownKeys: 'passthrough' | 'strict' | 'strip';
        catchall?: z.ZodTypeAny;
      };
      const shape = d.shape();
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value);
        if (
          value._def?.typeName !== ZK.ZodOptional &&
          value._def?.typeName !== ZK.ZodDefault
        ) {
          required.push(key);
        }
      }
      const out: JsonSchema = {
        type: 'object',
        properties,
      };
      if (required.length > 0) out.required = required;
      // Default unknownKeys behaviour is 'strip' — close additionalProperties
      // unless the schema explicitly allows extras (passthrough → true).
      if (d.unknownKeys === 'passthrough') out.additionalProperties = true;
      else out.additionalProperties = false;
      return out;
    }

    case ZK.ZodUnion:
    case ZK.ZodDiscriminatedUnion: {
      const d = def as { options?: z.ZodTypeAny[] };
      const options = (d.options ?? []) as z.ZodTypeAny[];
      return { oneOf: options.map(convert) };
    }

    case ZK.ZodIntersection: {
      const d = def as { left: z.ZodTypeAny; right: z.ZodTypeAny };
      return { allOf: [convert(d.left), convert(d.right)] };
    }

    case ZK.ZodRecord: {
      const d = def as { valueType: z.ZodTypeAny };
      return {
        type: 'object',
        additionalProperties: convert(d.valueType),
      };
    }

    case ZK.ZodTuple: {
      const d = def as { items: z.ZodTypeAny[] };
      return {
        type: 'array',
        items: d.items.map(convert),
        minItems: d.items.length,
        maxItems: d.items.length,
      };
    }

    case ZK.ZodDate: {
      return { type: 'string', format: 'date-time' };
    }

    case ZK.ZodAny:
    case ZK.ZodUnknown: {
      return {};
    }

    case ZK.ZodLazy: {
      const d = def as { getter: () => z.ZodTypeAny };
      return convert(d.getter());
    }

    case ZK.ZodEffects: {
      // Effects (.transform / .refine) — we can't represent refinements in
      // JSON Schema, but we can represent the inner shape. Transforms that
      // change the type (e.g. `string → number`) are not representable.
      const d = def as { schema: z.ZodTypeAny };
      return convert(d.schema);
    }

    case ZK.ZodOptional:
    case ZK.ZodNullable:
    case ZK.ZodDefault:
    case ZK.ZodCatch: {
      // Should have been unwrapped already; fall through to inner just in case.
      const d = def as { innerType?: z.ZodTypeAny };
      if (d.innerType) return convert(d.innerType);
      break;
    }

    default: {
      // ZK.ZodNaN, ZodUndefined, ZodNever, ZodVoid,
      // ZodSymbol, ZodMap, ZodSet, ZodFunction, ZodPromise, ZodBranded —
      // not used by the route inventory; throw so we notice.
      throw new Error(
        `zodToJsonSchema: unsupported zod node type "${String(typeName)}" — extend the converter`,
      );
    }
  }

  return {};
}

/* -------------------------------------------------------------------------- */
/* References                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Convert a Zod schema into an OpenAPI `$ref` (or inline schema if no
 * name is registered). Use this from `route-inventory.ts` so the spec
 * stays tied to the live zod schema instead of drifting.
 */
export function zodRef(name: string, schema: z.ZodTypeAny): JsonSchema {
  // Snapshot the schema once so callers can verify it round-trips.
  const json = convert(schema);
  registerSchema(name, json);
  return { $ref: `#/components/schemas/${name}` };
}

/** In-memory registry of named schemas, populated by `zodRef`. */
const SCHEMA_REGISTRY = new Map<string, JsonSchema>();

export function registerSchema(name: string, schema: JsonSchema): void {
  SCHEMA_REGISTRY.set(name, schema);
}

export function getSchema(name: string): JsonSchema | undefined {
  return SCHEMA_REGISTRY.get(name);
}

export function listSchemas(): Record<string, JsonSchema> {
  return Object.fromEntries(SCHEMA_REGISTRY.entries());
}