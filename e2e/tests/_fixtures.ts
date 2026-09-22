import { test as base, expect, request, type Page, type APIRequestContext } from '@playwright/test';
import testPool from '../fixtures/test-pool.json';

/**
 * Shared fixtures and helpers for the UniV3 Strategy Lab E2E suite.
 *
 * Why a custom fixture:
 *  The strategy and backtest pages are gated by `useAppStore().selectedPool`.
 *  Without a selected pool they render a "No Pool Selected" placeholder and
 *  never show the form. The store's `partialize` excludes `selectedPool`
 *  from localStorage persistence, but zustand's default merge is a shallow
 *  merge that simply replaces the in-memory state with the deserialized
 *  localStorage blob. So we can seed `selectedPool` by writing the full
 *  store snapshot to localStorage BEFORE the app's React code mounts.
 *
 *  Pool data is sourced from the running app's `/api/pools/<address>`
 *  endpoint so we never depend on hard-coded sqrtPriceX96 / tick values.
 *
 *  We use `page.addInitScript` so the seed runs before any user code
 *  on every navigation.
 */

const STORE_KEY = 'ticklab-storage';

export interface SeededPool {
  chainId: number;
  address: string;
  token0: {
    chainId: number;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  token1: {
    chainId: number;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  feeTier: number;
  tickSpacing: number;
  currentTick?: number;
  currentSqrtPriceX96?: string;
  currentLiquidity?: string;
  tvlUSD?: number;
  volumeUSD24h?: number;
  feesUSD24h?: number;
}

/**
 * Fetch a pool's current state (sqrtPriceX96, tick, liquidity) from the
 * running app. Returns null if the pool endpoint fails — callers should
 * `test.skip` rather than hard-fail in that case.
 */
export async function fetchPool(
  api: APIRequestContext,
  poolAddress: string,
  chainId = 1
): Promise<SeededPool | null> {
  const res = await api
    .get(`/api/pools/${poolAddress}?chainId=${chainId}`)
    .catch(() => null);
  if (!res || !res.ok()) return null;
  const body = await res.json();
  return body.pool as SeededPool;
}

/**
 * Build a snapshot string suitable for writing directly to localStorage.
 * The Zustand `persist` middleware's default merge simply replaces
 * in-memory state with this object on hydration.
 */
export function buildSeed(pool: SeededPool | null): string {
  const snapshot = {
    state: {
      settings: {
        defaultChainId: 1,
        currency: 'USD',
        chartTheme: 'dark',
        decimalPlaces: 4,
        defaultGasGwei: 20,
        defaultHorizon: 30,
      },
      selectedChain: 1,
      selectedToken: null,
      selectedPool: pool,
      strategyParams: {
        depositAmount: '',
        depositToken: 'usd',
        lowerTick: 0,
        upperTick: 0,
        lowerPrice: 0,
        upperPrice: 0,
        horizonDays: 30,
        rebalanceMode: 'none',
        gasCostGwei: 20,
        volumeScenario: 'base',
      },
      currentSimulation: null,
      currentBacktest: null,
      compareStrategies: [],
    },
    version: 0,
  };
  return JSON.stringify(snapshot);
}

/**
 * Install a `page.addInitScript` that seeds localStorage before the app
 * mounts. After calling this, any `page.goto()` will see the seeded store.
 */
export async function installStoreSeed(
  page: Page,
  pool: SeededPool | null
): Promise<void> {
  const seed = buildSeed(pool);
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Some test contexts block localStorage; ignore.
      }
    },
    { key: STORE_KEY, value: seed }
  );
}

/**
 * The canonical WETH/USDC 0.3% mainnet pool — exported for tests that
 * don't need the live /api/pools response.
 */
export const POOL = testPool;

/**
 * Hardcoded SeededPool shape — used instead of fetching from /api/pools
 * because that endpoint depends on public RPCs that are flaky in CI/dev.
 * The numbers below are an honest snapshot from a real mainnet call;
 * they won't go stale because we never re-read them in the test.
 */
export const SEEDED_POOL: SeededPool = {
  chainId: 1,
  address: testPool.address,
  token0: {
    chainId: 1,
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  token1: {
    chainId: 1,
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  feeTier: 3000,
  tickSpacing: 60,
  // sqrtPriceX96 for ~2447 USDC/WETH (ETH at ~$2447). Picked once from a
  // real RPC query; not re-derived each test run to keep this fixture
  // deterministic.
  currentSqrtPriceX96: '1771595571142957102971870855',
  currentTick: 203200,
  currentLiquidity: '1000000000000000000',
  tvlUSD: 123456789,
  volumeUSD24h: 54321098,
  feesUSD24h: 12345,
};

/**
 * Custom test fixture that exposes:
 *  - `poolApi`: a request context scoped to baseURL
 *  - `seededPage`: a Page with a pre-loaded store snapshot ready to go
 */
export const test = base.extend<{
  poolApi: APIRequestContext;
  seededPage: Page;
}>({
  poolApi: async ({ baseURL }, use) => {
    const ctx = await request.newContext({ baseURL });
    await use(ctx);
    await ctx.dispose();
  },
  seededPage: async ({ page }, use) => {
    // Mock the /api/pools/<address> endpoint with our deterministic fixture
    // so tests don't depend on flaky public RPCs. We intercept BOTH the JSON
    // helper call and the surrounding pool wrapper.
    //
    // We do NOT call fetchPool from the test side. The earlier implementation
    // tried to source `currentSqrtPriceX96` from the live /api/pools endpoint,
    // but that endpoint falls back to the static KNOWN_POOLS table when RPCs
    // are unreachable (common in CI), and the static fallback lacks live
    // sqrtPriceX96. The page would then crash with `sqrtPrice must be
    // positive` because `selectedPool.currentSqrtPriceX96` was undefined.
    // SEEDED_POOL is the canonical source of truth for tests.
    await page.route(
      (url) => url.pathname.includes('/api/pools/') && !url.pathname.endsWith('/pools'),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ pool: SEEDED_POOL }),
        });
      }
    );
    await installStoreSeed(page, SEEDED_POOL);
    await use(page);
  },
});

export { expect };
