#!/usr/bin/env bash
set -e

echo "Stopping running services..."
bun run docker:stop

echo "Cleaning temporary files and volumes..."
bun run clean

echo "Clearing database..."
bun run db:clear

echo "Starting services..."
bun run docker:start

echo "Waiting for database to be ready..."
sleep 3

echo "Running database migrations..."
bun run db:migrate:dev

echo "Environment reset successfully!"
