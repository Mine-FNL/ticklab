/**
 * @ticklab/sdk — example 1: quickstart.
 *
 * Backtest a single concentrated-liquidity range on WETH/USDC 0.05% over a
 * 30-day window. Run with:
 *
 *     npx tsx examples/quickstart.ts
 *
 * Requires a running Ticklab server. Default baseUrl points at the
 * production Vercel deploy; override with $TICKLAB_BASE_URL to point at
 * localhost:3000 during development.
 */

import { TicklabClient } from '@ticklab/sdk';
// Falls back to the local dist when run outside the monorepo (e.g. when
// someone copies this file as a quickstart).

const baseUrl = process.env.TICKLAB_BASE_URL ?? 'https://univ3-strategy-lab.vercel.app';
const client = new TicklabClient({ baseUrl });

async function main(): Promise<void> {
  console.log(`→ POST ${baseUrl}/api/backtests/run`);

  const result = await client.backtests.run({
    poolAddress: '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72', // WETH/USDC 0.05%
    chainId: 1,
    lowerPrice: 3000, // tight ±10% around $3333 spot
    upperPrice: 3700,
    depositUSD: 10_000,
    horizonDays: 30,
  });

  console.log('\n— Result —');
  console.log(`totalReturn:    ${(result.results.totalReturn * 100).toFixed(2)}%`);
  console.log(`totalFees:      $${result.results.totalFees.toFixed(2)}`);
  console.log(`timeInRange:    ${(result.results.timeInRange * 100).toFixed(1)}%`);
  console.log(`periodsOOR:     ${result.results.periodsOutOfRange}`);
  console.log(`backtestId:     ${result.backtestId}`);
  console.log(`useRealData:    ${result.useRealData}`);
  console.log(`requestId:      ${result.requestId}`);
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});