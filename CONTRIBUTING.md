# Contributing to December

We welcome contributions. To ensure a smooth process, please follow these guidelines when submitting patches and additions.

## Getting Started

1. Ensure you have Bun, Rust, and Docker installed.
2. Fork the repository and clone it locally.
3. Install dependencies by running `bun install` in the root directory.
4. Use `./scripts/containers.sh start` to start the necessary local services.

## Coding Standards

- We use Prettier for code formatting. Run `bun run format:check` before submitting a pull request, or `bun run format` to fix issues automatically.
- Keep files under 100 characters per line.
- Use 4-space indentation and single quotes.
- Ensure strict TypeScript compliance. Use Zod schemas for API boundaries.

## Testing

- Unit tests for the server are located in `server/tests/unit`.
- Run the curated server tests using `./scripts/test.sh`.
- Ensure your changes do not break existing tests and add new tests when introducing new features.
- For runtime modifications, run Rust checks using `cd runtime && cargo test`.

## Commit Messages

- Use clear, imperative commit messages (e.g., `fix(template): improve template ui` or `feat(auth): add login endpoint`).
- Keep commits focused on a single logical change.

## Pull Requests

- Provide a clear summary of the changes in your pull request description.
- Mention any issues your pull request resolves.
- If your pull request affects the web UI, please include screenshots or a recording of the change.
- Ensure all CI checks and local tests pass before requesting a review.
