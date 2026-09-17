# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for Next.js standalone output.
#
# Final image: ~150 MB on Alpine, runs as non-root, ships only what the
# standalone server needs (no dev deps, no full node_modules, no source).
#
# Build:   docker build -t ticklab:latest .
# Run:     docker run --rm -p 3000:3000 ticklab:latest
#
# Required env (optional at runtime; see docs/DEPLOY.md):
#   PORT      default 3000
#   HOSTNAME  default 0.0.0.0 (Next reads this)
#   BUILD_SHA optional, surfaced by /api/health

# -----------------------------------------------------------------------------
# Stage 1 — production-only dependencies. Used by both builder and runner.
# Next.js 14 with swcMinify compiles via SWC, so devDeps (typescript, eslint)
# are not needed at build time.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# -----------------------------------------------------------------------------
# Stage 2 — build the standalone output. `npm run build` produces
# `.next/standalone/` (containing a pruned server.js) plus `.next/static/`.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runner. Minimal image: only standalone server + static + public.
# Runs as `nextjs` (uid 1001) — never root.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001

# Standalone output ships `server.js` + a pruned `node_modules/` + `.next/`.
# `/public` and `/.next/static` are NOT included in standalone and must be
# copied explicitly from the builder.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER 1001:1001

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["wget", "-qO-", "http://localhost:3000/api/health"]

CMD ["node", "server.js"]
