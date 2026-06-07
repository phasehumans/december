#!/bin/bash
# Setup script for the December workspace

echo "Setting up December environment..."

# Install dependencies
bun install

# Start local infrastructure
./scripts/containers.sh start

# Apply database migrations
cd server
bunx prisma migrate dev

echo "December environment is ready!"
