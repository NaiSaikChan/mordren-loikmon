# syntax=docker/dockerfile:1
# Loikmon backend — build from the repository root:
#   docker build -f packages/backend/Dockerfile -t loikmon-backend .

# ── Stage 1: install + compile ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/media-standards/package.json ./packages/media-standards/
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --workspace=packages/backend --workspace=packages/media-standards --include-workspace-root=false --ignore-scripts
COPY packages/media-standards ./packages/media-standards
COPY packages/backend ./packages/backend
# `prebuild` compiles @loikmon/media-standards first.
RUN npm run build -w @loikmon/backend

# ── Stage 2: production dependencies only ───────────────────────────────────
# sharp needs no install script: its prebuilt libvips binary for musl ships as
# the optional @img/sharp-linuxmusl-* package recorded in the lockfile.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/media-standards/package.json ./packages/media-standards/
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --workspace=packages/backend --workspace=packages/media-standards --include-workspace-root=false --omit=dev --ignore-scripts \
  && npm cache clean --force \
  && mkdir -p packages/backend/node_modules

# ── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    PORT=4001 \
    APPLE_ROOT_CERTS_DIR=/app/packages/backend/certs/apple
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/packages/backend/node_modules ./packages/backend/node_modules
# node_modules/@loikmon/media-standards is a symlink to this directory.
COPY --chown=node:node packages/media-standards/package.json ./packages/media-standards/
COPY --from=builder --chown=node:node /app/packages/media-standards/dist ./packages/media-standards/dist
COPY --chown=node:node packages/backend/package.json ./packages/backend/
COPY --chown=node:node packages/backend/certs ./packages/backend/certs
COPY --from=builder --chown=node:node /app/packages/backend/dist ./packages/backend/dist
USER node
WORKDIR /app/packages/backend
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# tini forwards SIGTERM so the server drains connections on `docker compose down`.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
