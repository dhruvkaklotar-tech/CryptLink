#!/bin/bash
set -e

PORT=${PORT:-10000}
echo "==> [CryptLink] Booting all-in-one container on port $PORT..."

# 1. Start Redis
echo "==> [CryptLink] Starting local Redis daemon..."
redis-server --daemonize yes --port 6379

# 2. Start PostgreSQL
echo "==> [CryptLink] Initializing local PostgreSQL daemon..."
PG_VER=$(ls /usr/lib/postgresql/ 2>/dev/null | sort -V | tail -n 1)
if [ -n "$PG_VER" ]; then
    service postgresql start || true
    su - postgres -c "psql -c \"DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'chat_user') THEN CREATE ROLE chat_user LOGIN PASSWORD 'change-this-password'; END IF; END \$\$;\"" || true
    su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = 'chat_auth'\" | grep -q 1 || psql -c \"CREATE DATABASE chat_auth OWNER chat_user;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE chat_auth TO chat_user;\"" || true
fi

# 3. Start SurrealDB on dedicated port 8001
echo "==> [CryptLink] Starting SurrealDB on 127.0.0.1:8001..."
mkdir -p /data/surreal
surreal start --log error --user root --pass change-this-password --bind 127.0.0.1:8001 rocksdb:/data/surreal/database.db &
sleep 2

# 4. Configure environment for FastAPI
export DATABASE_URL="postgresql+asyncpg://chat_user:change-this-password@localhost:5432/chat_auth"
export REDIS_URL="redis://localhost:6379"
export SURREAL_URL="ws://127.0.0.1:8001"
export SURREAL_USER="root"
export SURREAL_PASSWORD="change-this-password"
export SURREAL_NAMESPACE="chat"
export SURREAL_DATABASE="production"
export SECRET_KEY="${SECRET_KEY:-c8f3b92e71d4a06584f2e91b5c3a7d9f1e4b8a2c6d0e3f7a9b1c5d8e2f4a6b8c}"
export ENV="production"
export DEBUG="false"

HOSTNAME="${RENDER_EXTERNAL_HOSTNAME:-localhost}"
export RP_ID="${HOSTNAME}"
export RP_NAME="CryptLink"
export RP_ORIGIN="https://${HOSTNAME}"
export CORS_ORIGINS="[\"https://${HOSTNAME}\", \"http://${HOSTNAME}\", \"http://localhost:${PORT}\", \"http://127.0.0.1:${PORT}\"]"

echo "==> [CryptLink] Launching FastAPI backend on 127.0.0.1:8000..."
uvicorn app.factory:create_app --factory --host 127.0.0.1 --port 8000 &
sleep 2

# 5. Substitute PORT in nginx configuration and run in foreground
echo "==> [CryptLink] Starting Nginx on port $PORT..."
envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
exec nginx -g "daemon off;"
