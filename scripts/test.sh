#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export PATH="$PATH:/home/chaitanya/.bun/bin"

echo "[test] Starting all Docker containers..."
cd "$PROJECT_ROOT"
bun run docker:start

echo "[test] Running database migrations on test database..."
cd "$PROJECT_ROOT/packages/database"
bun run db:migrate:test

echo "[test] Running tests..."
cd "$PROJECT_ROOT"
bun run test:agent
bun run test:tools
bun run test:providers