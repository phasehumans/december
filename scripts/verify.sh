#!/usr/bin/env bash
set -e

echo "Running format check..."
bun run format:check

echo "Running linting..."
bun run lint

echo "Running tests..."
bun run test

echo "Running build..."
bun run build

echo "All verification checks passed successfully!"
