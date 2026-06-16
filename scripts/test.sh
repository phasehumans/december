#!/usr/bin/env bash

set -e

# Ensure bun is in PATH
export PATH="$PATH:/home/chaitanya/.bun/bin"

cd apps/server

# write updated tests for module; integration, canvas, upload

bun test test/unit/auth.unit.test.ts
bun test test/integration/auth/auth.routes.test.ts
bun test test/integration/auth/auth.service.test.ts

# # bun test test/unit/billing.unit.test.ts
# # bun test test/integration/billing/billing.routes.test.ts
# # bun test test/integration/billing/billing.service.test.ts

bun test test/unit/canvas.unit.test.ts
bun test test/integration/canvas/canvas.routes.test.ts
bun test test/integration/canvas/canvas.service.test.ts

# # bun test test/unit/generation.unit.test.ts
# # bun test test/integration/generation/generation.routes.test.ts
# # bun test test/integration/generation/generation.service.test.ts

bun test test/unit/integration.unit.test.ts
bun test test/integration/integration/integration.routes.test.ts
bun test test/integration/integration/integration.service.test.ts

bun test test/unit/notification.unit.test.ts
bun test test/integration/notification/notification.routes.test.ts
bun test test/integration/notification/notification.service.test.ts

bun test test/unit/profile.unit.test.ts
bun test test/integration/profile/profile.routes.test.ts
bun test test/integration/profile/profile.service.test.ts

bun test test/unit/project.unit.test.ts
bun test test/integration/project/project.routes.test.ts
bun test test/integration/project/project.service.test.ts

# bun test test/unit/runtime.unit.test.ts
# bun test test/integration/runtime/runtime.routes.test.ts
# bun test test/integration/runtime/runtime.service.test.ts

bun test test/unit/template.unit.test.ts
bun test test/integration/template/template.routes.test.ts
bun test test/integration/template/template.service.test.ts

bun test test/unit/upload.unit.test.ts
bun test test/integration/upload/upload.routes.test.ts
bun test test/integration/upload/upload.service.test.ts

# bun test test/unit/usage.unit.test.ts
# bun test test/integration/usage/usage.routes.test.ts
# bun test test/integration/usage/usage.service.test.ts
