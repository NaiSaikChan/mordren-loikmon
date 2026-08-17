# Stage 1: Vite build
FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_BASE=/
ARG VITE_API_BASE=/api
ENV VITE_BASE=$VITE_BASE
ENV VITE_API_BASE=$VITE_API_BASE
COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
RUN npm ci --workspace=packages/api --workspace=packages/web --ignore-scripts
COPY packages/api ./packages/api
COPY packages/web ./packages/web
RUN npm run build -w @loikmon/web

# Stage 2: Nginx
FROM nginx:1.27-alpine AS runner
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ | grep -q '<div id="app">' || exit 1
