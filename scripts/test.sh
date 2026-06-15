#!/usr/bin/env bash

set -e

# Ensure bun is in PATH
export PATH="$PATH:/home/chaitanya/.bun/bin"

cd server

# write updated tests for module; integration, canvas, upload

bun test tests/unit/auth.unit.test.ts
bun test tests/integration/auth/auth.routes.test.ts
bun test tests/integration/auth/auth.service.test.ts

# # bun test tests/unit/billing.unit.test.ts
# # bun test tests/integration/billing/billing.routes.test.ts
# # bun test tests/integration/billing/billing.service.test.ts

bun test tests/unit/canvas.unit.test.ts
bun test tests/integration/canvas/canvas.routes.test.ts
bun test tests/integration/canvas/canvas.service.test.ts

# # bun test tests/unit/generation.unit.test.ts
# # bun test tests/integration/generation/generation.routes.test.ts
# # bun test tests/integration/generation/generation.service.test.ts

bun test tests/unit/integration.unit.test.ts
bun test tests/integration/integration/integration.routes.test.ts
bun test tests/integration/integration/integration.service.test.ts

bun test tests/unit/notification.unit.test.ts
bun test tests/integration/notification/notification.routes.test.ts
bun test tests/integration/notification/notification.service.test.ts

bun test tests/unit/profile.unit.test.ts
bun test tests/integration/profile/profile.routes.test.ts
bun test tests/integration/profile/profile.service.test.ts

bun test tests/unit/project.unit.test.ts
bun test tests/integration/project/project.routes.test.ts
bun test tests/integration/project/project.service.test.ts

# bun test tests/unit/runtime.unit.test.ts
# bun test tests/integration/runtime/runtime.routes.test.ts
# bun test tests/integration/runtime/runtime.service.test.ts

bun test tests/unit/template.unit.test.ts
bun test tests/integration/template/template.routes.test.ts
bun test tests/integration/template/template.service.test.ts

bun test tests/unit/upload.unit.test.ts
bun test tests/integration/upload/upload.routes.test.ts
bun test tests/integration/upload/upload.service.test.ts

# bun test tests/unit/usage.unit.test.ts
# bun test tests/integration/usage/usage.routes.test.ts
# bun test tests/integration/usage/usage.service.test.ts
