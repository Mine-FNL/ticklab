/**
 * @ticklab/sdk — example 3: V4 hook discovery + LP-score ranking.
 *
 * Walks the V4 hook discovery endpoint and prints the top 5 hooks by
 * `lpScore` (Ticklab's composite of fee capture, MEV resistance, and
 * capital efficiency). Useful for funds building V4 allocation policies.
 *
 *     npx tsx examples/v4-hooks.ts
 */

import { TicklabClient } from '@ticklab/sdk';

const baseUrl = process.env.TICKLAB_BASE_URL ?? 'https://univ3-strategy-lab.vercel.app';
const client = new TicklabClient({ baseUrl });

async function main(): Promise<void> {
  console.log(`→ Discovering V4 hooks on Ethereum`);

  const hooks = await client.v4Hooks.discover({
    chainId: 1,
    category: 'all',
    minTvlUsd: 100_000,
    limit: 50,
  });

  const ranked = [...hooks.items].sort((a, b) => b.lpScore - a.lpScore).slice(0, 5);

  console.log(`\n— Top ${ranked.length} hooks by LP score —\n`);
  console.log(
    ['Hook', 'Category', 'TVL', 'Fee (24h)', 'Score'].map((s) => s.padEnd(20)).join(''),
  );
  console.log('-'.repeat(100));
  for (const h of ranked) {
    console.log(
      [
        h.name.padEnd(20),
        h.category.padEnd(20),
        `$${(h.tvlUsd / 1e6).toFixed(1)}M`.padEnd(20),
        `$${(h.feesUsd24h / 1e3).toFixed(1)}k`.padEnd(20),
        h.lpScore.toFixed(2),
      ].join(''),
    );
  }
  console.log(`\nrequestId: ${hooks.requestId}`);
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});