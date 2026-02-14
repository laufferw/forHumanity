#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:8080}}"
API_BASE="$BASE_URL/api"

echo "Running smoke tests against: $BASE_URL"

health_status=$(curl -sS -o /tmp/fh_health.json -w "%{http_code}" "$API_BASE/health")
if [[ "$health_status" != "200" ]]; then
  echo "❌ /api/health failed with status $health_status"
  exit 1
fi

echo "✅ /api/health ok"

metrics_status=$(curl -sS -o /tmp/fh_metrics.json -w "%{http_code}" "$API_BASE/metrics")
if [[ "$metrics_status" != "200" ]]; then
  echo "❌ /api/metrics failed with status $metrics_status"
  exit 1
fi

echo "✅ /api/metrics ok"

home_status=$(curl -sS -o /tmp/fh_home.html -w "%{http_code}" "$BASE_URL/")
if [[ "$home_status" != "200" ]]; then
  echo "❌ / failed with status $home_status"
  exit 1
fi

echo "✅ / homepage reachable"

echo "🎉 Smoke test passed"
