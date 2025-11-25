#!/bin/sh
set -e

# Read secrets and construct environment variables
if [ -f /run/secrets/postgres_password ]; then
  export POSTGRES_PASSWORD=$(cat /run/secrets/postgres_password)
  export POSTGRES_URL="postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-cryptoart}"
fi

if [ -f /run/secrets/redis_password ]; then
  export REDIS_PASSWORD=$(cat /run/secrets/redis_password)
  export REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379"
fi

# Execute the main command
exec "$@"

