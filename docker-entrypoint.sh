#!/bin/sh
set -e

if [ "${PRISMA_MIGRATE_ON_START:-}" = "1" ]; then
  echo "Running Prisma migrations (deploy)..."
  npx prisma migrate deploy
fi

exec "$@"
