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

echo "[test] Running auth tests..."
cd "$PROJECT_ROOT/apps/server"
NODE_ENV=test bun test --preload ./test/env.ts ./test/unit/auth.unit.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/auth/auth.routes.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/auth/auth.service.test.ts

echo "[test] Running canvas tests..."
NODE_ENV=test bun test --preload ./test/env.ts ./test/unit/canvas.unit.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/canvas/canvas.routes.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/canvas/canvas.service.test.ts

echo "[test] Running import tests..."
NODE_ENV=test bun test --preload ./test/env.ts ./test/unit/import.unit.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/import/import.routes.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/import/import.service.test.ts

echo "[test] Running integration module tests..."
NODE_ENV=test bun test --preload ./test/env.ts ./test/unit/integration.unit.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/integration/integration.routes.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/integration/integration.service.test.ts

echo "[test] Running notification tests..."
NODE_ENV=test bun test --preload ./test/env.ts ./test/unit/notification.unit.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/notification/notification.routes.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/notification/notification.service.test.ts

echo "[test] Running profile tests..."
NODE_ENV=test bun test --preload ./test/env.ts ./test/unit/profile.unit.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/profile/profile.routes.test.ts
NODE_ENV=test bun test --preload ./test/env.ts ./test/integration/profile/profile.service.test.ts
