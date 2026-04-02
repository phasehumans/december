# Repository Guidelines

## Project Structure & Module Organization
`web/` contains the Bun + React client; main code lives in `web/src`, optional browser tests in `web/tests`, and build output in `web/dist`. `server/` contains the Bun API; feature code is organized under `server/src/modules`, shared config/helpers under `server/src/config` and `server/src/lib`, and Prisma schema plus migrations under `server/prisma`. `e2e/` holds Playwright specs and helpers. `infra/` contains local infrastructure such as MinIO and Docker setup. `runtime/` and `scripts/` contain preview/runtime and maintenance utilities.

## Build, Test, and Development Commands
- `bun run lint`: run ESLint for the repository.
- `bun run format`: apply Prettier formatting.
- `cd web && bun run dev`: start the frontend locally.
- `cd web && bun run build`: create the production frontend bundle.
- `cd server && bun run dev`: start the API in watch mode.
- `cd server && node ./node_modules/prisma/build/index.js generate --schema prisma/schema.prisma`: regenerate Prisma client after schema changes.
- `npx tsc --noEmit -p web/tsconfig.json` and `npx tsc --noEmit -p server/tsconfig.json`: typecheck each app.
- `npx playwright test`: run end-to-end specs in `e2e/`.

## Coding Style & Naming Conventions
Use 4-space indentation, UTF-8, LF endings, single quotes, no semicolons, trailing commas where supported, and a 100-column width. Follow existing naming: PascalCase for React components (`OutputScreen.tsx`), camelCase for hooks/utilities (`useAppController.ts`), and feature-oriented backend files such as `canvas.service.ts` or `generation.schema.ts`. Keep imports grouped and remove unused imports; ESLint enforces both.

## Testing Guidelines
Prefer Playwright coverage for user-facing flows and name browser specs `*.spec.ts` in `e2e/`. Keep backend or integration checks in `server/tests` as `*.test.ts`. Add regression coverage when changing generation, preview, canvas persistence, or project retrieval behavior. No formal coverage gate is defined, but changed paths should be exercised before merge.

## Commit & Pull Request Guidelines
Recent commits use short imperative subjects with optional scopes, for example `fix: prompt and plan agent contracts mismatch` and `fix(agent): align the agents contract and schema validation`. Follow the same pattern with `feat:`, `fix:`, or `chore:` prefixes. PRs should include a brief summary, linked issue/reference when available, screenshots for UI changes, notes for schema or env updates, and the exact validation run.

## Security & Configuration Tips
Do not commit real `.env` values. Update `.env.example` when adding configuration. Treat Prisma migrations, S3/MinIO settings, and preview/runtime credentials as sensitive and document required setup in the PR.
