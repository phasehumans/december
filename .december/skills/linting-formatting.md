# Skill: Code Formatting and Linting

**Context:** The monorepo uses Prettier for formatting and ESLint for static analysis across both the web and server workspaces.

**Essential Commands (Run from the root directory):**

- **Auto-Fix Formatting:** `bun run format` 
  *(This runs Prettier across all supported files in the repository)*
- **Check Formatting (Used in CI):** `bun run format:check`
- **Auto-Fix Linting Issues:** `bun run lint:fix`
- **Check Linting Issues:** `bun run lint`

**Troubleshooting Commits:**
Husky pre-commit hooks will automatically attempt to run `prettier --write` via `lint-staged`. 
- If a commit fails with `'prettier' is not recognized`, ensure you have run `bun install` at the root directory.
- If you urgently need to bypass the styling rules to push code, use: `git commit --no-verify`.
