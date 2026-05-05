#!/usr/bin/env bash

set -e

cd server

bun test tests/unit/auth.unit.test.ts
bun test tests/integration/auth/auth.service.test.ts
bun test tests/integration/auth/auth.routes.test.ts

bun test tests/unit/profile.unit.test.ts
bun test tests/integration/profile/profile.service.test.ts
bun test tests/integration/profile/profile.routes.test.ts

bun test tests/unit/project.unit.test.ts
bun test tests/integration/project/project.service.test.ts
bun test tests/integration/project/project.routes.test.ts

bun test tests/unit/template.unit.test.ts
bun test tests/integration/template/template.service.test.ts
bun test tests/integration/template/template.routes.test.ts