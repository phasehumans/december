#!/usr/bin/env bash

set -e

# Ensure bun is in PATH
export PATH="$PATH:/home/chaitanya/.bun/bin"

cd apps/server

bun test test/unit/auth.unit.test.ts
bun test test/integration/auth/auth.routes.test.ts
bun test test/integration/auth/auth.service.test.ts

