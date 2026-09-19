/**
 * @ticklab/sdk — example 2: full risk report.
 *
 * Runs a backtest and immediately pipes the equity curve into the risk
 * analytics endpoint to produce VaR, CVaR, Sharpe, Sortino, max drawdown,
 * and Calmar ratio. Useful for fund-grade LP dashboards.
 *
 *     npx tsx examples/risk-report.ts
 */

import { TicklabClient, type EquityPoint } from '@ticklab/sdk';

const baseUrl = process.env.TICKLAB_BASE_URL ?? 'https://univ3-strategy-lab.vercel.app';
const client = new TicklabClient({ baseUrl });

async function main(): Promise<void> {
  console.log(`→ Running backtest on WETH/USDC 0.05% (30d, $10k)`);

  const backtest = await client.backtests.run({
    poolAddress: '0x88e6a0c2ddd26feeb64f039a2c4122fcb7f78a72',
    chainId: 1,
    lowerPrice: 3000,
    upperPrice: 3700,
    depositUSD: 10_000,
    horizonDays: 30,
  });

  // Build a synthetic equity curve from the backtest's day-by-day returns.
  // For a real integration, drop in your own equity points from your
  // telemetry source.
  const equityCurve: EquityPoint[] = buildEquityCurve(backtest.equityCurve ?? []);

  console.log(`→ Computing risk report (VaR, Sharpe, Sortino, maxDD, Calmar)`);

  const report = await client.risk.compute({
    equityCurve,
    riskFreeRate: 0.04, // 4% annualised
  });

  console.log('\n— Risk Report —');
  console.log(`Value at Risk (95%):       ${(report.valueAtRisk * 100).toFixed(2)}%`);
  console.log(`Conditional VaR (95%):    ${(report.conditionalVaR * 100).toFixed(2)}%`);
  console.log(`Sharpe ratio:              ${report.sharpeRatio.toFixed(2)}`);
  console.log(`Sortino ratio:             ${report.sortinoRatio.toFixed(2)}`);
  console.log(`Annualised volatility:     ${(report.annualizedVolatility * 100).toFixed(2)}%`);
  console.log(`Max drawdown:              ${(report.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`Calmar ratio:              ${report.calmarRatio.toFixed(2)}`);
  console.log(`requestId:                 ${report.requestId}`);
}

/**
 * Build an equity curve from the backtest's daily-return series.
 * Returns a flat $10k curve if the backtest result doesn't expose
 * `equityCurve` (older API versions don't).
 */
function buildEquityCurve(raw: ReadonlyArray<{ timestamp: number; equity: number }>): EquityPoint[] {
  if (raw.length === 0) {
    const now = Date.now();
    return Array.from({ length: 30 }, (_, i) => ({
      timestamp: now - (29 - i) * 86_400_000,
      equity: 10_000,
    }));
  }
  return raw.map((p) => ({ timestamp: p.timestamp, equity: p.equity }));
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});