/**
 * GET /api/health
 *
 * Liveness + readiness probe. Cheap, no caching, no rate limit.
 */

import { apiHandler, apiConfig } from '@/lib/api/handler';

export const { dynamic, runtime } = apiConfig();

export const GET = apiHandler<unknown, {
  status: 'ok';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}>({
  name: 'health',
  schema: null,
  handler: async () => {
    return {
      status: 'ok',
      service: 'univ3-strategy-lab',
      version: process.env.npm_package_version ?? '0.1.0',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
});