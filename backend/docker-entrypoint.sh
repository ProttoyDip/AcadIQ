#!/bin/sh
set -eu

attempt=1
until npm run prisma:migrate:deploy; do
  if [ "$attempt" -ge 10 ]; then
    echo "Database migration failed after $attempt attempts" >&2
    exit 1
  fi
  echo "Database is not ready; retrying migration ($attempt/10)" >&2
  attempt=$((attempt + 1))
  sleep 3
done

exec node dist/server.js
