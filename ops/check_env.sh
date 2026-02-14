#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAGING_ENV="$ROOT_DIR/.env.staging"

if [[ ! -f "$STAGING_ENV" ]]; then
  echo "❌ Missing .env.staging (copy from .env.staging.example)"
  exit 1
fi

required=(
  JWT_SECRET
  CLIENT_ORIGIN
  RATE_LIMIT_WINDOW_MS
  RATE_LIMIT_MAX
  MAX_FAILED_LOGIN_ATTEMPTS
  LOGIN_LOCKOUT_MINUTES
  FAILED_ATTEMPT_TTL_MINUTES
  AUTH_TOKEN_TTL
)

missing=0
for key in "${required[@]}"; do
  if ! grep -qE "^${key}=" "$STAGING_ENV"; then
    echo "❌ Missing key in .env.staging: $key"
    missing=1
  fi
done

if grep -q "JWT_SECRET=change-me" "$STAGING_ENV"; then
  echo "❌ JWT_SECRET is still default"
  missing=1
fi

if [[ "$missing" -eq 1 ]]; then
  echo "\nEnv check failed."
  exit 1
fi

echo "✅ Env sanity check passed"
