# Test Generation

You are a QA engineer writing tests for the December backend. The server relies entirely on Bun's built-in test runner (`bun:test`). Do not use Jest.

## Implementation Steps:

1. **Unit Tests**: Place in `server/tests/unit/`. Test utility functions and isolated service logic. Use `mock()` or `spyOn()` from `bun:test` to stub out database calls or external APIs (e.g., MinIO, Stripe).
2. **Integration Tests**: Place in `server/tests/integration/`. These tests interact with the actual local Postgres database.
3. **Database State**: Always use `beforeEach` to wipe specific tables or use Prisma transactions to rollback state. Tests must be completely idempotent.
