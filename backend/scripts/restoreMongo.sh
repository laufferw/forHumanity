#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-archive.tgz>" >&2
  exit 1
fi

ARCHIVE_PATH="$1"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
WORK_DIR="$ROOT_DIR/.tmp-restore"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/forHumanity}"

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

if ! command -v mongorestore >/dev/null 2>&1; then
  echo "mongorestore not found. Install MongoDB Database Tools first." >&2
  exit 1
fi

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

tar -xzf "$ARCHIVE_PATH" -C "$WORK_DIR"
EXTRACTED_DIR="$(find "$WORK_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

if [[ -z "$EXTRACTED_DIR" ]]; then
  echo "Failed to find extracted backup directory" >&2
  exit 1
fi

mongorestore --uri "$MONGODB_URI" --drop "$EXTRACTED_DIR"

rm -rf "$WORK_DIR"

echo "Restore completed from: $ARCHIVE_PATH"
