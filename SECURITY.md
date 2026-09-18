# Security policy

Ticklab is a non-custodial analytics tool — it does not hold user
funds, does not sign transactions, and does not store wallet private
keys. The wallet-connect surface uses the standard
[RainbowKit](https://www.rainbowkit.com/) + [wagmi](https://wagmi.sh/)
stack, which delegates signing to the user's own wallet.

Even so, the API surface (`app/api/*`) and the SDK (`packages/sdk/`)
are public, so we treat input validation, dependency hygiene, and
secret handling seriously.

## Supported versions

Only the latest minor release receives security fixes. Older minors
are not patched — please upgrade.

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | ✅ Active          |
| < 0.1   | ❌ End of life     |

Until 1.0.0 the minor version is the upgrade target — there is no
long-term-support branch.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security bugs.** Send
a private report instead:

- **Email:** security@ticklab.dev (replies within 72 hours)
- **GitHub:** Use [GitHub's private vulnerability reporting](https://github.com/Mine-FNL/ticklab/security/advisories/new)
  on the repo's Security tab.

Include as much of the following as you can:

1. A short description of the vulnerability and its impact
2. Steps to reproduce, ideally with a minimal PoC
3. The commit hash / release tag where you observed it
4. Your assessment of severity (informational / low / medium / high /
   critical)
5. Whether you'd like public credit in the advisory

### Response SLA

| Severity | Acknowledgement | Patch target |
|----------|-----------------|--------------|
| Critical | 24 hours        | 7 days       |
| High     | 48 hours        | 14 days      |
| Medium   | 72 hours        | 30 days      |
| Low      | 72 hours        | 90 days      |

The patch target is the date we ship a fix **or** a documented
mitigation; it does not guarantee a CVE number, which we coordinate
through GitHub Security Advisories on a case-by-case basis.

## What is in scope

- **Server-side input validation gaps** in any `app/api/*/route.ts`
  handler that could lead to SSRF, prototype pollution, arbitrary
  file read, or unauthenticated resource use.
- **Dependency vulnerabilities** with a known exploit and a fix
  available — we run `pnpm audit` weekly and on every PR.
- **Wallet integration bugs** that cause the wrong transaction to be
  signed, the wrong network to be active, or the user's address to
  be mis-rendered (e.g. checksum bypass leading to a different
  valid address than the one the user approved).
- **Secret leakage** — anything that causes an env var, API key, or
  private key to be returned to a client, logged to stdout, or
  committed to the repo.

## What is out of scope

- **Loss of funds from LP strategies** — Ticklab is a simulator, not
  a position manager. Every backtest page surfaces the disclaimer
  that historical performance does not predict future results, and
  every projection is computed against user-supplied strategy
  parameters. We do not issue refunds or advisories for realized
  trading losses.
- **Public-RPC outages or rate limits** — the public RPCs in
  `lib/constants.ts` are free endpoints with no SLA. If you need
  guaranteed uptime, supply your own RPC via `NEXT_PUBLIC_ETHEREUM_RPC_URL`
  or similar.
- **Cosmetic UI bugs** — please file a regular issue, not a security
  report.
- **Vulnerabilities in upstream dependencies** that have no known
  exploit and no available fix — we'll address them in the next
  regular dependency-update PR.

## Dependency hygiene

- CI runs `pnpm audit --prod --audit-level=high` on every push.
- Renovate opens weekly PRs for non-breaking dependency updates.
- Critical patches are merged out-of-band within 24 hours of CVE
  publication.

## API key handling

Ticklab's zero-config value prop is real: the harness and the live
API require **no** paid keys. The one optional key —
`COVALENT_API_KEY` for the GoldRush overlay — is:

- Read via `process.env`, never `import.meta.env`, never from a
  client bundle.
- Never logged, even on error. The `getCovalentApiKey()` helper in
  `lib/data/covalent.ts` only includes the key in the outbound
  request URL, never in thrown error messages.
- Never committed. `.env.example` lists every supported key with an
  empty value; `.env*` is gitignored.

If you find a path that violates any of these rules, that's a
security bug — please report it privately per the SLA above.