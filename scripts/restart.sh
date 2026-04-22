#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[phasehumans] Restarting dev stack..."

"$SCRIPT_DIR/stop.sh" || true
sleep 1
exec "$SCRIPT_DIR/start.sh"