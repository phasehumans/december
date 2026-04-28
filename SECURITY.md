# Security Policy

## Supported Scope

Security reports should cover the current `main` branch and actively developed code in this repository:

- `server/`: Bun/Express API, auth, uploads, Prisma, S3 access, and generation workflows.
- `web/`: React frontend and API client behavior.
- `runtime/`: Rust runtime, workspace handling, Docker sandbox integration, and storage access.
- `infra/`: local Postgres and MinIO Docker Compose configuration.

Historical branches, local-only experiments, and generated dependency code are not actively supported unless the issue also affects current application behavior.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability. Report it privately to the project maintainers with:

- a concise description of the issue and affected area;
- reproduction steps or proof of concept;
- expected impact, such as account access, data exposure, file access, or service disruption;
- relevant logs, requests, screenshots, or commit references, with secrets redacted.

If you are unsure whether something is security-sensitive, treat it as private first.

## Secrets and Configuration

Never commit `.env`, `.env.test`, API keys, tokens, private keys, database dumps, or production credentials. This project uses environment variables for sensitive services, including `DATABASE_URL`, `JWT_SECRET`, Google and GitHub OAuth credentials, `OPENROUTER_API_KEY`, `RESEND_API_KEY`, S3/MinIO credentials, and `RUNTIME_SHARED_SECRET`.

Use local-only credentials for development. Rotate any secret that may have been exposed in commits, logs, screenshots, test fixtures, or shared terminals.

## Secure Development Guidelines

- Validate request bodies with the existing schema patterns before using input.
- Keep authentication and authorization checks in server routes and middleware, not only in the web UI.
- Treat uploads, extracted archives, and generated project files as untrusted input.
- Avoid logging tokens, cookies, authorization headers, user secrets, or full environment objects.
- Keep Prisma migrations reviewable and avoid destructive data changes without an explicit migration plan.
- Use the Docker sandbox and runtime boundaries deliberately; do not broaden host file or network access unless required and reviewed.

## Dependency and Infrastructure Notes

Run dependency updates intentionally and review lockfile changes. For local backing services, prefer the Docker Compose files in `infra/postgres` and `infra/minio`. Before sharing bug reports or traces, redact database URLs, S3 endpoints and keys, OAuth secrets, JWTs, and runtime shared secrets.
