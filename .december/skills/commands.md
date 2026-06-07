# Skill: Essential CLI Commands

A quick reference for the most common tasks executed in the root repository.

## Installation
`bun install` - Installs workspaces for both `web/` and `server/`.

## Quality Assurance
`bun run format:check` - Validates Prettier compliance (used in CI).
`bun run lint` - Validates ESLint compliance.
`bun test` (inside `/server`) - Runs the backend test suite.

## Tooling
`bun run changelog` - Generates `CHANGELOG.md` using `git-cliff`.
`bun run release` - Triggers the automated release script.
