# Skill: Testing the Monorepo

**Context:** The December project uses multiple test environments: Bun for the backend, Cargo for Rust, and optionally Playwright for E2E.

**How to execute tests:**

1. **Server Unit Tests (Fast, no DB required):**
   `cd server && bun test tests/unit`

2. **Server Integration Tests (Requires local Docker DB):**
   It's recommended to use the dedicated bash script:
   `./scripts/test.sh`

3. **Rust Runtime Tests:**
   `cd runtime && cargo test`

4. **Web E2E Tests (Playwright):**
   (If configured) `cd web && bunx playwright test`
