# Build the web app
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Same-origin by default: nginx below proxies /api to the backend.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Serve with nginx, as an unprivileged user on port 8080. Dependabot keeps the digest current.
FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6
# Empty defaults, so that the template is always fully rendered.
ENV CSP_EXTRA_MEDIA_SOURCES=""
ENV HSTS_HEADER_VALUE=""
COPY infra/nginx.conf /etc/nginx/templates/default.conf.template
COPY infra/security-headers.conf /etc/nginx/security-headers.conf
COPY infra/backend-proxy.conf /etc/nginx/backend-proxy.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
EXPOSE 8080
