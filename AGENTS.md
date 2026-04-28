# Repository Guidelines

## Project Structure & Module Organization

This is a multi-service app. `web/` contains the React frontend, with feature code in `web/src/features`, shared UI and helpers in `web/src/shared`, and entry files in `web/src`. `server/` contains the Bun/Express API, organized by domain modules in `server/src/modules`, shared utilities in `server/src/lib` and `server/src/utils`, and Prisma files in `server/prisma`. `server/tests` holds unit and integration tests. `runtime/` is a Rust service split across `runtime/src/app`, `domain`, `services`, `sandboxes`, and `http`. Infrastructure is in `infra/`; helper scripts are in `scripts/`.

## Build, Test, and Development Commands

- `bun install`, `cd server && bun install`, `cd web && bun install`: install JavaScript dependencies.
- `./scripts/start.sh`: starts runtime, server, and web in a `tmux` session.
- `./scripts/stop.sh`: stops the local `phasehumans` session.
- `cd server && bun run dev`: run the API with file watching.
- `cd web && bun run dev`: run the frontend dev server.
- `cd web && bun run build`: build the frontend bundle.
- `cd server && bun test`: run server unit and integration tests.
- `cd runtime && cargo run`: run the Rust runtime directly.
- `cd runtime && cargo test`: run Rust tests.
- `bun run format:check` / `bun run format`: check or apply Prettier formatting at the repo root.

## Coding Style & Naming Conventions

Use TypeScript for server and web changes. Follow module naming in `server/src/modules/<domain>`: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.schema.ts`, and `*.utils.ts`. React components use PascalCase filenames, hooks start with `use`, and feature-specific types live near their feature. Rust code should follow `rustfmt` and snake_case module names. Prettier formats JS, TS, CSS, HTML, JSON, YAML, and Markdown.

## Testing Guidelines

Server tests use Bun’s test runner. Place narrow tests in `server/tests/unit/*.unit.test.ts` and API or workflow tests in `server/tests/integration/*.integration.test.ts`. Prefer fixtures from `server/tests` over ad hoc setup. For Rust changes, add module-level tests when practical and run `cargo test`.

## Commit & Pull Request Guidelines

Recent commits use short imperative messages, sometimes with a prefix such as `fix(outputscreen): ...` or `fix: ...`. Keep commits focused and mention the affected area when useful. Pull requests should include a concise summary, test results, linked issues when applicable, and screenshots or recordings for UI changes.

## Security & Configuration Tips

Do not commit `.env` files or secrets. Prisma changes should include a migration under `server/prisma/migrations`. Use the Docker Compose files in `infra/postgres` and `infra/minio` for local backing services when needed.
