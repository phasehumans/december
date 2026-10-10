## build_and_test

- Monorepo uses Bun and Turborepo. Tests run against .env.test. Run test database migrations before tests via 'bun --cwd packages/database db:migrate:test'.

## architecture

- Server module structure follows gold standards (auth, notification, session): routes, controller, service, repository, schema, types, utils. Service functions must be arrow functions taking a single typed 'data' parameter destructured on line 1, with types in <module>.types.ts and exported exclusively via a singleton object.

## conventions

- No require() imports (ES modules only). No empty catch blocks without explanatory comments. Scoped switch cases with curly braces for const/let. No em dashes anywhere in the repo. Git commit messages and PR titles/descriptions must be strictly lowercase.
