#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy || echo "Migration skipped or already applied."

echo "Starting server..."
exec node dist/server.js
