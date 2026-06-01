#!/bin/bash
set -e

# Resolve repository root directory
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting full database reset..."

# Ensure Postgres container is running
echo "Verifying local Postgres container..."
cd "$BASE_DIR"
./scripts/containers.sh start

# Reset development database
echo "Resetting development database..."
cd "$BASE_DIR/server"
bunx prisma migrate reset --force

# Reset integration test database
echo "Resetting test database..."
bunx dotenv -e .env.test -- bunx prisma migrate reset --force

echo "Database reset completed successfully!"
