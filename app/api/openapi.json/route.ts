/**
 * GET /api/openapi.json
 *
 * Machine-readable OpenAPI 3.1 contract for the API surface.
 *
 * Generated on demand from `lib/api/openapi/spec.ts`. Cached for 5 minutes
 * — code changes invalidate the cache, and the spec is regenerated fresh on
 * every deploy, so a long TTL is safe.
 */

import { buildSpec } from '@/lib/api/openapi/spec';

export const { dynamic, runtime } = {
  dynamic: 'force-dynamic',
  runtime: 'nodejs',
} as const;

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify(buildSpec(), null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}