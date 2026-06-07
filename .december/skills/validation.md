# Skill: Strict Validation & Formatting

The codebase enforces strict quality checks across all environments.

## Formatting (Prettier)
- Run `bun run format` to auto-fix styling across `.ts`, `.tsx`, `.md`, and `.json` files.
- The project uses 4-space indentation, single quotes, and no semicolons.

## Linting (ESLint)
- Run `bun run lint:fix` to resolve standard TypeScript and React hooks issues.
- The project enforces unused imports removal and strict type boundaries.

## Git Hooks
Husky is configured to run formatting automatically on commit. If you encounter issues, ensure you've run `bun install` first. To bypass in an emergency, use `git commit --no-verify`.
