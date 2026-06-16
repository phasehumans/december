#!/bin/bash
set -e

export PATH="/home/chaitanya/.bun/bin:$PATH"

# Load NVM for Node 22+ (required by Prisma 7.x)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
    nvm use 22 2>/dev/null || true
fi

# Resolve repository root directory
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOTENV_BIN="$BASE_DIR/apps/server/node_modules/.bin/dotenv"

echo "Starting full database reset..."

# Ensure Postgres container is running
echo "Verifying local Postgres container..."
cd "$BASE_DIR"
./scripts/containers.sh start

cd "$BASE_DIR/packages/database"

# Reset development database
echo "Resetting development database..."
"$DOTENV_BIN" -e "$BASE_DIR/apps/server/.env" -- bunx prisma migrate reset --force

# Reset test database
echo "Resetting test database..."
if [ -f "$BASE_DIR/apps/server/.env.test" ] && [ -s "$BASE_DIR/apps/server/.env.test" ]; then
    "$DOTENV_BIN" -e "$BASE_DIR/apps/server/.env.test" -- bunx prisma migrate reset --force
else
    echo "Skipping test database reset (.env.test is empty or missing)"
fi

echo "Database reset completed successfully"
