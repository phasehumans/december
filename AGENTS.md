# Repository Guidelines

## Project Structure & Module Organization

This is a Bun/TypeScript monorepo with a Rust runtime. The web client lives in `web/src`, with feature modules in `web/src/features`, shared UI in `web/src/shared`, and app wiring in `web/src/app`. The API server lives in `server/src`; domain modules use `server/src/modules/<area>` with matching `*.routes.ts`, `*.controller.ts`, `*.service.ts`, and `*.schema.ts` files. Server tests are in `server/tests/unit` and `server/tests/integration`. Prisma schema and migrations are under `server/prisma`. The Rust runtime is in `runtime/src`; local dependency Compose files are in `infra/postgres` and `infra/minio`.

## Build, Test, and Development Commands

- `bun install`: install root dependencies; also run in `web` or `server` after package changes.
- `./scripts/containers.sh start`: start local Postgres and MinIO containers.
- `./scripts/start.sh`: launch runtime, server, and web in a tmux session.
- `cd server && bun run dev`: run the API server with watch mode.
- `cd web && bun run dev`: run the web app with hot reload.
- `cd web && bun run build`: build the web bundle through `web/build.ts`.
- `cd server && bun test`: run all Bun server tests.
- `./scripts/test.sh`: run curated server auth, profile, project, and template suites.
- `cd runtime && cargo run`: run the Rust runtime locally.

## Coding Style & Naming Conventions

Use Prettier from the root config: 4-space indentation, single quotes, no semicolons, trailing commas where valid, and 100-character lines. Run `bun run format:check` before a PR, or `bun run format` to fix formatting. TypeScript is strict; prefer Zod schemas for API boundaries and keep file names aligned with existing patterns such as `billing.service.ts` or `ProjectListRow.tsx`.

## Testing Guidelines

Server tests use Bun’s test runner. Place isolated tests in `server/tests/unit/*.unit.test.ts`; place route and persistence coverage under `server/tests/integration/<module>/*.test.ts`. Integration tests may require `cd server && bun run test:migrate`. For runtime changes, add or run Rust checks with `cd runtime && cargo test` when tests exist.

## Commit & Pull Request Guidelines

Recent history uses concise imperative commits, sometimes with scopes, for example `fix(template): improve template ui` and `feat(template): impl remix template`. Keep commits focused and mention issue or PR numbers when relevant. Pull requests should include a behavior summary, test commands run, linked issues, and screenshots or recordings for visible web changes.

## Security & Configuration Tips

Do not commit secrets or local `.env` files. Keep database and object-storage changes reflected in Prisma migrations and the relevant Docker-backed local setup.
