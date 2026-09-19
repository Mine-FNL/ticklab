# @ticklab/sdk — examples

Three runnable, copy-pasteable examples that cover the most common SDK
integration paths. All three use the production Vercel deploy by default;
override with `TICKLAB_BASE_URL=http://localhost:3000` for local dev.

## Setup

```bash
# From the repo root, with Node 20+:
pnpm install
pnpm --filter @ticklab/sdk build

# Run any example:
npx tsx examples/quickstart.ts
npx tsx examples/risk-report.ts
npx tsx examples/v4-hooks.ts
```

## What's in here

| Example              | What it does                                                                       |
|----------------------|------------------------------------------------------------------------------------|
| `quickstart.ts`      | Backtests a single WETH/USDC range over 30 days, prints totalReturn / APY / fees. |
| `risk-report.ts`     | Same backtest, then pipes the equity curve into the risk endpoint for VaR / Sharpe / Sortino / maxDD / Calmar. |
| `v4-hooks.ts`        | Walks the V4 hook discovery endpoint and prints the top 5 hooks by `lpScore`.     |

## Common patterns

### 1. Tree-shakeable imports

Both shapes work — pick the one your bundler likes:

```ts
// Class form (object access, easy to mock)
import { TicklabClient } from '@ticklab/sdk';
const client = new TicklabClient({ baseUrl });
await client.backtests.run({ ... });

// Function form (pulls only what you need into the bundle)
import { backtestsRun, TicklabClient } from '@ticklab/sdk';
await backtestsRun(client, { ... });
```

### 2. Cancellation

Every method accepts an optional `AbortSignal`. Pass a controller's
signal to cancel an in-flight call:

```ts
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 5_000);
await client.backtests.run({ ..., signal: ctrl.signal });
```

### 3. Retries

The client retries `429` and `5xx` automatically with exponential
backoff + jitter (`Retry-After` honored). Configure via `ClientConfig`:

```ts
new TicklabClient({ baseUrl, maxRetries: 5, baseBackoffMs: 500 });
```

### 4. Error handling

Non-retryable failures throw `TicklabError` with a stable `code`:

```ts
import { TicklabError, isTicklabError } from '@ticklab/sdk';
try {
  await client.backtests.run({ ... });
} catch (err) {
  if (isTicklabError(err)) {
    console.log(`Ticklab error: ${err.code} — ${err.message}`);
    console.log(`requestId: ${err.requestId}`); // useful for support
  }
}
```

## Environment / config

| Env var              | Purpose                                          |
|----------------------|--------------------------------------------------|
| `TICKLAB_BASE_URL`   | Override the API base URL (default: production Vercel deploy). |

## License

MIT — same as the rest of the repo.