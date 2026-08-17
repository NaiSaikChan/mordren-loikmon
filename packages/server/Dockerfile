# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/server/package.json ./packages/server/
RUN npm ci --workspace=packages/api --workspace=packages/server --ignore-scripts
COPY packages/api ./packages/api
COPY packages/server ./packages/server
RUN npm run build -w @loikmon/api
RUN npm run build -w @loikmon/server

# Stage 2: run
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/server/package.json ./packages/server/
RUN npm ci --workspace=packages/server --omit=dev --ignore-scripts
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "packages/server/dist/index.js"]
