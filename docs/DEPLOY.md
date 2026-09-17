# Deployment Guide

Production runbook for **UniV3 Strategy Lab** — Next.js 14 App Router, three
supported targets:

1. **Vercel** — zero-config recommended.
2. **Docker** — single image, runs anywhere.
3. **Self-hosted** — `node server.js` behind a reverse proxy.

---

## 1. Quick start — Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-org%2Fticklab)

```bash
npm i -g vercel
vercel              # preview deploy
vercel --prod       # promote to production
```

`vercel.json` pins build/dev commands, regions (`iad1`, `fra1`), and baseline
security headers (`X-Content-Type-Options`, `X-Frame-Options`) for `/api/*`.

**Custom domain:** Vercel dashboard → Project → **Settings → Domains** →
add `app.example.com`, then add the printed CNAME at your DNS provider.
The first deploy succeeds with **no env vars** — public RPCs and DefiLlama
are used by default; RPC API keys are optional upgrades.

---

## 2. Docker

Next.js standalone output, multi-stage Alpine build.

```bash
docker build -t ticklab:latest .
docker run --rm -p 3000:3000 \
  -e BUILD_SHA="$(git rev-parse --short HEAD)" \
  ticklab:latest
curl -s http://localhost:3000/api/health | jq
```

- Final image: `node:20-alpine` + ~30 MB app deps → **~85 MB compressed**.
- Runs as `nextjs` (uid 1001), never root.
- `HEALTHCHECK` hits `/api/health` every 30s; unhealthy after 3 retries.
- No required env. Recommended: `BUILD_SHA` (so `/api/health` exposes the commit).

---

## 3. Self-hosted (Linux + systemd)

```bash
npm ci --no-audit --no-fund
npm run build                 # emits .next/standalone/

rsync -av --exclude=node_modules \
  .next/standalone/   user@app:/srv/univ3/
rsync -av .next/static/        user@app:/srv/univ3/.next/static/
rsync -av public/             user@app:/srv/univ3/public/

ssh user@app.example.com "sudo systemctl restart univ3"
```

### systemd unit — `/etc/systemd/system/univ3.service`

```ini
[Unit]
Description=UniV3 Strategy Lab
After=network.target

[Service]
Type=simple
User=univ3
WorkingDirectory=/srv/univ3
Environment=NODE_ENV=production
Environment=BUILD_SHA=unknown
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### nginx reverse proxy

```nginx
server {
  server_name app.example.com;
  location / { proxy_pass http://127.0.0.1:3000; }
  location /api/health { proxy_pass http://127.0.0.1:3000; access_log off; }
}
```

Caddy: `app.example.com { reverse_proxy 127.0.0.1:3000 }`.

---

## 4. Monitoring — `GET /api/health`

`{status, uptime, buildSha, checks[]}` is the single source of truth.

| Trigger                                  | Severity |
| ---------------------------------------- | -------- |
| `status == "degraded"` ≥ 2 min           | warn     |
| `status == "degraded"` ≥ 10 min          | page     |
| HTTP 5xx on `/api/*` > 1% (5m)           | page     |
| `/api/*` p95 > 2000 ms (5m)              | warn     |
| Container restart count > 3 in 10 min    | page     |

Cron-friendly probe:

```bash
curl -fsS http://app/api/health | jq -e '.status == "ok"' || systemctl restart univ3
```

---

## 5. CI/CD

See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — runs
lint + typecheck + test + build on Node 20. Vercel auto-deploys `master`.
Tagged `v*.*.*` releases should push images to GHCR/Docker Hub when
distribution becomes a real channel.

---

## 6. Required env vars

The app runs with **zero env vars**. Everything below is optional.

| Name | Required? | Default | Description |
| ---- | --------- | ------- | ----------- |
| `PORT` | no | `3000` | HTTP listen port. |
| `HOSTNAME` | no | `0.0.0.0` | Bind address. |
| `BUILD_SHA` | no | `unknown` | Surfaced by `/api/health`; inject `$GITHUB_SHA` in CI. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | no | unset | WalletConnect Cloud project id. |
| `ETHERSCAN_API_KEY` / `ALCHEMY_API_KEY` / `INFURA_KEY` | no | unset | RPC tier upgrades (free). |
| `NEXT_PUBLIC_*_RPC_URL` | no | public defaults | Per-chain RPC fallbacks. |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | no | unset | Sentry APM. |
| `NEXT_PUBLIC_DISABLE_DEFILLAMA` / `NEXT_PUBLIC_DISABLE_LIVE_RPC` | no | `false` | Runtime feature flags. |

Full canonical list in [`.env.example`](../.env.example).

---

## 7. Rollback

Roll back by promoting the last known-good tag — on Vercel open
**Deployments → ⋮ → Promote to Production** on a prior green build; on
Docker re-run the container pinned to the previous image tag
(`ticklab:v0.1.3-1`); on self-hosted
`git checkout <last-good-sha>` inside `/srv/univ3` and
`systemctl restart univ3`. Confirm with `/api/health` returning
`status:"ok"`. **Always pin a specific image tag or git SHA in production
— never `latest`.**
