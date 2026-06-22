#!/usr/bin/env bash

set -e

# Resolve project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun is in PATH
export PATH="$PATH:/home/chaitanya/.bun/bin"

# 1. Start all Docker containers
echo "[test] Starting all Docker containers..."
cd "$PROJECT_ROOT"
bun run docker:start

# 2. Run database migrations on the test database
echo "[test] Running database migrations on test database..."
cd "$PROJECT_ROOT/packages/database"
bun run db:migrate:test

# 3. Run the auth module tests
echo "[test] Running auth tests..."
NODE_ENV=test bun test ./test/unit/auth.unit.test.ts
NODE_ENV=test bun test ./test/integration/auth/auth.routes.test.ts
NODE_ENV=test bun test ./test/integration/auth/auth.service.test.ts

