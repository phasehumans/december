# Contributing

## Getting Started

Phasehumans is a multi-service app with a Bun/Express API, React frontend, and Rust runtime. Install the required tools first:

- Bun for `server/` and `web/`;
- Rust and Cargo for `runtime/`;
- tmux for the helper scripts;
- Docker if you need local Postgres or MinIO from `infra/`.

Install dependencies from the repo root and package directories:

```sh
bun install
cd server && bun install
cd ../web && bun install
```

Use local `.env` files only. Do not commit secrets.

## Local Development

Start the full stack with:

```sh
./scripts/start.sh
```

This opens a `phasehumans` tmux session for the Rust runtime, API server, and web app. Stop it with:

```sh
./scripts/stop.sh
```

You can also run services directly:

```sh
cd runtime && cargo run
cd server && bun run dev
cd web && bun run dev
```

## Code Organization

Keep changes close to the relevant module. Server domains live in `server/src/modules/<domain>` using files such as `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.schema.ts`, and `*.utils.ts`. Web features live in `web/src/features`; shared components and helpers belong in `web/src/shared`. Runtime code is grouped under `runtime/src/app`, `domain`, `services`, `sandboxes`, and `http`.

## Quality Checks

Before opening a pull request, run the checks that match your change:

```sh
bun run format:check
cd server && bun test
cd web && bun run build
cd runtime && cargo test
```

Use `bun run format` to apply Prettier formatting. Rust changes should follow `rustfmt` defaults.

## Testing

Server tests use Bun’s test runner. Put focused unit tests in `server/tests/unit/*.unit.test.ts` and API or workflow coverage in `server/tests/integration/*.integration.test.ts`. Reuse existing test helpers in `server/tests` where possible. Add Rust module tests when changing runtime behavior.

## Commits and Pull Requests

Keep commits small and use short imperative messages. Existing history includes messages like `fix(outputscreen): fix container and add options forms` and `fix: file parser and extract zip`.

Pull requests should include:

- a brief summary of the change;
- commands run and their results;
- linked issues or context;
- screenshots or recordings for UI changes;
- notes for migrations, new environment variables, or infrastructure changes.

## Security

Follow `SECURITY.md` for vulnerability reporting and secret handling. Never include `.env` contents, tokens, database URLs, OAuth secrets, S3 credentials, JWTs, or runtime shared secrets in commits, logs, screenshots, or PR text.
