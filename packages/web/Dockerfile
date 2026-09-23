# Stage 1: Vite build
FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_BASE=/
ARG VITE_API_BASE=/api/v1
ARG VITE_PLAY_STORE_URL=
ARG VITE_APP_STORE_URL=
ENV VITE_BASE=$VITE_BASE
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_PLAY_STORE_URL=$VITE_PLAY_STORE_URL
ENV VITE_APP_STORE_URL=$VITE_APP_STORE_URL
COPY package.json package-lock.json ./
COPY packages/media-standards/package.json ./packages/media-standards/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
RUN npm ci --workspace=packages/media-standards --workspace=packages/api --workspace=packages/web --ignore-scripts
# Media standards are compiled from source by Vite (see the alias in vite.config.ts).
COPY packages/media-standards ./packages/media-standards
COPY packages/api ./packages/api
COPY packages/web ./packages/web
RUN npm run build -w @loikmon/web

# Stage 2: Nginx
FROM nginx:1.27-alpine AS runner
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
# 127.0.0.1, not localhost: nginx only listens on IPv4 here, and localhost can
# resolve to ::1 first. Traefik drops unhealthy containers from its routing
# table, so a false negative here shows up publicly as a 404.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
