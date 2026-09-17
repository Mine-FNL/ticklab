import { NextRequest } from 'next/server';
import { renderPrometheusMetrics } from '@/lib/api/metrics';

export const { dynamic, runtime } = {
  dynamic: 'force-dynamic',
  runtime: 'nodejs',
} as const;

/**
 * Prometheus-compatible /metrics endpoint.
 *
 * Output format: Prometheus text exposition (v0.0.4). Safe to scrape at
 * any frequency; renders in O(N) where N = cardinality of the metrics
 * store (route + method + status_class).
 *
 * Auth: NONE by default. If exposed publicly, gate behind:
 *   - Network-level allowlist (preferred for prod)
 *   - Or `Authorization: Bearer <PROMETHEUS_TOKEN>` header check
 *   - Or a basic-auth proxy in front (Vercel Edge supports this)
 *
 * For internal-only deployment on Vercel, the default unauthenticated
 * endpoint is fine — Vercel routes never expose this URL externally
 * unless you put it in the proxy.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const body = renderPrometheusMetrics();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      // Metrics scrapers cache aggressively; tell them they can keep
      // the response for 30s before re-fetching.
      'Cache-Control': 'public, max-age=30',
      // Don't let anyone put metrics behind auth that depends on cookies.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
