#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

printf "\n==> 1) Env sanity check\n"
"$ROOT_DIR/ops/check_env.sh"

printf "\n==> 2) Backend checks\n"
cd "$ROOT_DIR/backend"
npm ci
npm run lint
npm run format:check
npm test

printf "\n==> 3) Frontend checks\n"
cd "$ROOT_DIR/frontend"
npm ci
npm run lint
npm run format:check
npm run test -- --watchAll=false
npm run build

printf "\n✅ Preflight passed. Ready to release.\n"
