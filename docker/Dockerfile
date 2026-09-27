# ── Build stage ──────────────────────────────────────────────────────
# Build context is the repository root (see docker-compose.yml), so paths
# below are relative to it.
FROM node:20-alpine AS builder

WORKDIR /app

COPY exam-arena-frontend/package.json exam-arena-frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY exam-arena-frontend/ ./

# Vite inlines VITE_* variables into the bundle at build time, so the backend
# URLs are build arguments, not runtime environment. The browser calls the
# API directly, which is why the defaults point at the host-published port.
ARG VITE_API_BASE_URL=http://localhost:8080
ARG VITE_WS_BASE_URL=ws://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
  VITE_WS_BASE_URL=$VITE_WS_BASE_URL

RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1

