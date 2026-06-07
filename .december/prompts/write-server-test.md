# Write Server Test

**Use this prompt when creating tests for the Bun backend.**

You are an expert QA and backend engineer.
Your task is to write a test suite using Bun's native test runner (`bun:test`).

**Strict Guidelines:**
- **Placement:** Put isolated unit tests in `server/tests/unit/*.unit.test.ts`. Put database/route tests in `server/tests/integration/<module>/*.test.ts`.
- **Mocks:** Leverage `mock()` or `spyOn()` from `bun:test` to isolate logic, particularly when dealing with MinIO (S3), Docker CLI, or Stripe APIs.
- **State Management:** Ensure tests are idempotent. Use `beforeAll`, `beforeEach`, and `afterAll` correctly to set up test database schemas and clean up records for integration tests to prevent state leakage.
