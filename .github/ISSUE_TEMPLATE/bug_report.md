---
name: Bug report
about: Report broken behavior in the simulator, the UI, the API, or the SDK
title: "[bug] "
labels: bug
assignees: ''
---

## Summary

<!-- One or two sentences. What's broken? -->

## Steps to reproduce

<!-- Numbered list. Minimal — assume we have the project cloned but not the env. -->

1.
2.
3.

## Expected behavior

<!-- What should have happened? -->

## Actual behavior

<!-- What actually happened? Include error messages, screenshots, or a
     short screencap if it's a UI bug. -->

## Environment

- **Ticklab version:** (run `pnpm --filter ticklab list ticklab` or check the commit hash on `/about`)
- **Node version:** (run `node -v`)
- **pnpm version:** (run `pnpm -v`)
- **OS:** (e.g. macOS 14.4, Ubuntu 22.04)
- **Browser:** (if it's a UI bug, e.g. Chrome 124 / Firefox 125)
- **Chain + pool:** (if it's a data/sim bug — e.g. Ethereum / WETH-USDC 0.05%)
- **API key status:** (none / `COVALENT_API_KEY` set / other)

## Validation harness regression?

<!-- If the bug is in the simulator or a data adapter, paste the
     failing row from `validation-results/validation-<timestamp>.csv`
     here. This is the single fastest way for us to reproduce. -->

| Pool | Days | Sim cum return | GT cum return | Abs err (pp) | Rel err |
|------|------|----------------|---------------|--------------|---------|
|      |      |                |               |              |         |

## Logs

<!-- Anything from `pnpm dev`, `pnpm test`, `pnpm validate:northstar`,
     or browser DevTools that helps us see the failure. Trim to the
     relevant 20-50 lines. -->

```
paste here
```

## Anything else?

<!-- Screenshots, related issues, "this also breaks X" notes. -->