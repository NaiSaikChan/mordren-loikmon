# ============================================================================
# @loikmon/backend — multi-stage production image
# Build context is the REPO ROOT (needs workspace package.json + lockfile).
#   docker build -f packages/backend/Dockerfile -t loikmon-backend .
# ============================================================================

# ---- Stage 1: build TypeScript -------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps using the workspace manifests only (better layer caching).
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
# --legacy-peer-deps: the web workspace has a pre-existing vite peer conflict;
# backend itself is clean, but a root install still resolves the whole graph.
RUN npm ci --legacy-peer-deps --ignore-scripts || \
    npm install --legacy-peer-deps --ignore-scripts

COPY packages/backend ./packages/backend
RUN npm run build -w @loikmon/backend

# ---- Stage 2: production runtime -----------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install ONLY backend production deps.
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
RUN npm install --legacy-peer-deps --omit=dev --ignore-scripts \
      -w @loikmon/backend \
    && npm cache clean --force

# Compiled output.
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Run as the non-root `node` user shipped in the base image.
USER node

EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||4001)+'/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "packages/backend/dist/index.js"]
