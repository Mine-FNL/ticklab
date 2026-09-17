# `@univ3-strategy-lab/sdk`

TypeScript SDK for the [univ3-strategy-lab](https://app.example.com) API —
backtests, risk analytics, simulations, pool discovery, and V4 hooks.

- Zero runtime dependencies (uses native `fetch`)
- Works in Node 18+ and the browser
- Tree-shakeable (every endpoint is a top-level exportable function)
- Typed errors with a `code` discriminator for safe retries
- AbortSignal propagation on every method
- Exponential backoff with jitter, honours `Retry-After`

## Install

```bash
npm install @univ3-strategy-lab/sdk
```

## Quick start

```typescript
import { UnivariateClient, UnivariateError } from '@univ3-strategy-lab/sdk';

const client = new UnivariateClient({
  baseUrl: 'https://app.example.com',
  apiKey: process.env.UNIVARIATE_API_KEY, // optional
});

// Run a backtest
const backtest = await client.backtests.run({
  poolAddress: '0x8ad599c3a0cc1a8a26606766b157530d66f33675',
  lowerPrice: 2200,
  upperPrice: 2700,
  depositAmount: 10_000,
  depositToken: 'usd',
  rebalanceMode: 'none',
  feeTier: 3000,
  token0Decimals: 6,
  token1Decimals: 18,
  useRealData: true,
});

console.log(backtest.results.totalReturn); // 0.12 → 12%
console.log(backtest.results.equityCurve); // [{ timestamp, lpValue, hodlValue, fees }]
console.log(backtest.requestId);            // 'req_…' for tracing

// Compute risk metrics
const risk = await client.risk.compute({
  equityCurve: backtest.results.equityCurve.map((p) => ({
    timestamp: p.timestamp,
    lpValue: p.lpValue,
  })),
  riskFreeRate: 0.04,
});

console.log(risk.sharpeRatio);     // 1.6
console.log(risk.maxDrawdown);     // 0.08
console.log(risk.valueAtRisk95);   // 0.02

// Pool + V4 hooks discovery
const pools = await client.pools.discover({ chainId: 1 });
const hooks = await client.v4.hooks.discover();
```

## Tree-shakeable imports

If you only need one endpoint, import the standalone function instead of
the whole `UnivariateClient`:

```typescript
import { UnivariateClient, backtestsRun } from '@univ3-strategy-lab/sdk';

const client = new UnivariateClient({ baseUrl: 'https://app.example.com' });
const backtest = await backtestsRun(client, { /* … */ });
```

Bundlers will drop `riskCompute`, `poolsDiscover`, etc. when only
`backtestsRun` is referenced.

## Cancellation

Every method accepts an optional `{ signal }` (an `AbortSignal`):

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);
try {
  await client.backtests.run(params, { signal: controller.signal });
} catch (err) {
  if (err instanceof UnivariateError && err.code === 'aborted') {
    console.log('cancelled');
  }
}
```

## Error handling

```typescript
import { UnivariateError, isUnivariateError } from '@univ3-strategy-lab/sdk';

try {
  await client.risk.compute({ equityCurve: [] }); // too short → 400
} catch (err) {
  if (isUnivariateError(err)) {
    switch (err.code) {
      case 'validation':  // bad caller input → don't retry
      case 'rate_limit':  // 429 → safe to retry with backoff
      case 'upstream':    // 502/503/504 → safe to retry
      case 'internal':    // 500 → may be safe to retry
      case 'network':     // fetch threw → safe to retry
      case 'aborted':     // caller cancelled
      case 'unknown':
    }
    console.error(err.toJSON());
    console.error('requestId:', err.requestId);
  } else {
    throw err;
  }
}
```

Retries on `rate_limit` and `internal`/`upstream`/`network` happen
automatically (default 3 attempts with exponential backoff + jitter). Pass
`{ maxRetries: 0 }` to disable for a single call.

## Configuration

```typescript
new UnivariateClient({
  baseUrl: 'https://app.example.com',
  apiKey: 'sk_…',
  maxRetries: 3,        // default; cap is 5
  baseBackoffMs: 250,   // default; full-jitter exponential
  timeoutMs: 30_000,    // per-attempt timeout
  defaultHeaders: { 'x-team': 'risk-bot' },
  fetch: customFetch,   // override (e.g. msw, instrumented fetch)
});
```

## License

MIT