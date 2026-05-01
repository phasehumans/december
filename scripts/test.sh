#!/usr/bin/env bash

set -e

cd server

bun test tests/unit/auth.unit.test.ts
bun test tests/integration/auth/auth.service.test.ts
bun test tests/integration/auth/auth.routes.test.ts

# sleep 3

# bun test tests/unit/profile.unit.test.ts
# bun test tests/integration/profile/profile.service.test.ts
# bun test tests/integration/profile/profile.routes.test.ts

