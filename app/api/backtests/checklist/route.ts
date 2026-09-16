/**
 * POST /api/backtests/checklist
 *
 * Pre-deposit red-flag checklist. Validates the input shape via Zod and
 * delegates to the pure `runChecklist` engine. No caching — every call
 * returns a fresh verdict so the user always sees the current state.
 *
 * Rate limited under `RateLimitPresets.compute` (30/min) since the engine
 * itself is cheap but we want to discourage scraping the heuristic logic.
 */

import { apiConfig, apiHandler } from '@/lib/api/handler';
import { RateLimitPresets } from '@/lib/api/rate-limit';
import {
  runChecklist,
  checklistInputSchema,
  type ChecklistInput,
} from '@/lib/simulation/checklist';

export const { dynamic, runtime } = apiConfig();

export const POST = apiHandler<ChecklistInput>({
  name: 'backtests.checklist',
  schema: checklistInputSchema as unknown as Parameters<typeof apiHandler<ChecklistInput>>[0]['schema'],
  source: 'body',
  rateLimit: RateLimitPresets.compute,
  handler: async ({ params }) => {
    return runChecklist(params);
  },
});