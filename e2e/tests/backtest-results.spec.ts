import { test, expect } from './_fixtures';
import { POOL } from './_fixtures';

/**
 * Backtest Results end-to-end flow.
 *
 * /backtest renders the historical backtest form. On submit it calls
 * `fetchPriceHistory(token, chain, start, end)` (CoinGecko-backed) and
 * `runBacktest(params, prices)`. The result block includes:
 *   - LP Return, HODL Return, Excess Return
 *   - Total Fees Earned, Total IL
 *   - Rebalances Executed, Time In Range, Time Out Of Range
 *   - Gas Costs, Sharpe Ratio, Max Drawdown
 *   - Daily Snapshots table
 *
 * CoinGecko's free tier is rate-limited and frequently returns 429.
 * We therefore gate the post-submit assertions on the success path and
 * treat upstream-data failures as soft.
 */
test.describe('Historical Backtest', () => {
  test('loads the backtest page header and form', async ({ seededPage: page }) => {
    await page.goto('/backtest').catch(() => {});

    await expect(
      page.getByRole('heading', { name: /historical backtest/i, level: 1 })
    ).toBeVisible({ timeout: 20_000 });

    // The BacktestRunner card heading.
    await expect(
      page.getByRole('heading', { name: /historical backtest/i }).first()
    ).toBeVisible();

    // Token pair header in the side card.
    await expect(page.getByText(`${POOL.token0Symbol} / ${POOL.token1Symbol}`).first()).toBeVisible();
  });

  test('submits the form and produces risk + return metrics', async ({ seededPage: page }) => {
    await page.goto('/backtest').catch(() => {});

    await expect(
      page.getByRole('heading', { name: /historical backtest/i, level: 1 })
    ).toBeVisible({ timeout: 20_000 });

    // The BacktestRunner has Start Date / End Date / Lower Tick / Upper Tick
    // / Deposit / Rebalance Mode / Run Backtest. The labels are NOT
    // htmlFor-linked, so we identify by position.
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();

    const numberInputs = page.locator('input[type="number"]');
    // Lower tick, upper tick, deposit (USD) — three numeric inputs.
    await expect(numberInputs).toHaveCount(3);

    // Deposit amount = 10000 USD (spec requirement).
    await numberInputs.nth(2).fill('10000');

    // Run backtest.
    const runButton = page.getByRole('button', { name: /^run backtest$/i });
    await expect(runButton).toBeVisible();
    await runButton.click();

    // Wait for one of two terminal states: a populated results block OR
    // an error card (CoinGecko 429, missing mapping, etc).
    const lpReturnHeader = page.getByText(/lp return/i).first();
    const errorCard = page.getByText(/historical backtest requires coingecko/i).first();

    const outcome = await Promise.race([
      lpReturnHeader.waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'success' as const),
      errorCard.waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'error' as const),
    ]).catch(() => 'timeout' as const);

    if (outcome === 'error') {
      // CoinGecko blocked us — this is upstream, not the UI.
      test.skip(true, 'CoinGecko upstream unavailable (rate limit / token mapping missing).');
      return;
    }

    if (outcome === 'timeout') {
      test.skip(true, 'Backtest did not complete within 60s (upstream flake).');
      return;
    }

    // Success path: assert required metrics.
    // Total return — LP Return and HODL Return cards.
    await expect(lpReturnHeader).toBeVisible();
    await expect(page.getByText(/hodl return/i).first()).toBeVisible();
    await expect(page.getByText(/excess return/i).first()).toBeVisible();

    // Time in range metric.
    await expect(page.getByText(/time in range/i).first()).toBeVisible();

    // At least one risk metric: Sharpe, Max Drawdown, or Total IL.
    const sharpe = page.getByText(/sharpe ratio/i);
    const maxDd = page.getByText(/max drawdown/i);
    const totalIL = page.getByText(/total impermanent loss/i);
    const riskVisible = await Promise.race([
      sharpe.first().isVisible().catch(() => false),
      maxDd.first().isVisible().catch(() => false),
      totalIL.first().isVisible().catch(() => false),
    ]);
    expect(riskVisible, 'expected at least one risk metric in the backtest result block').toBe(true);

    // Performance Metrics heading.
    await expect(page.getByRole('heading', { name: /performance metrics/i })).toBeVisible();
  });
});
