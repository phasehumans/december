#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[december] Stopping Docker containers..."
cd "$PROJECT_ROOT"
bun run docker:stop

echo "[december] Docker containers stopped."
