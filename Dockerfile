# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

RUN corepack enable && corepack prepare pnpm@10.29.1 --activate

COPY frontend/package.json frontend/pnpm-lock.yaml* frontend/.npmrc* ./

RUN pnpm install --frozen-lockfile

COPY frontend/ ./

RUN pnpm run build

# Stage 2: Unified Container
FROM python:3.13-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql \
    postgresql-contrib \
    redis-server \
    nginx \
    gettext-base \
    curl \
    build-essential \
    libpq-dev \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install SurrealDB
RUN curl -sSf https://install.surrealdb.com | sh

WORKDIR /app

# Install Python backend dependencies
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY backend/pyproject.toml ./
RUN uv pip install --system greenlet -e .
COPY backend/ .

# Copy built frontend to Nginx web root
COPY --from=frontend-builder /app/frontend/dist /var/www/cryptlink

# Copy Nginx config template & entrypoint
COPY conf/render/nginx.conf.template /etc/nginx/nginx.conf.template
COPY conf/render/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=10000
EXPOSE 10000

CMD ["/entrypoint.sh"]

