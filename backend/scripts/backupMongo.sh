#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT_DIR="$BACKUP_DIR/$STAMP"
ARCHIVE="$BACKUP_DIR/forHumanity-$STAMP.tgz"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/forHumanity}"

mkdir -p "$OUT_DIR"

if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump not found. Install MongoDB Database Tools first." >&2
  exit 1
fi

mongodump --uri "$MONGODB_URI" --out "$OUT_DIR"

tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$STAMP"
rm -rf "$OUT_DIR"

echo "Backup created: $ARCHIVE"
