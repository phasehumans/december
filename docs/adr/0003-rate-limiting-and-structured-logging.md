# 3. Rate Limiting & Structured Logging Architecture

Date: 2026-07-23

## Status

Accepted

## Context

The server needed a scalable rate limiting mechanism to protect API routes against abuse and high traffic, as well as a centralized, high-performance structured logging subsystem for HTTP request correlation and module event debugging.

## Decision

1. **Structured Logging (`StructuredLogger`)**:
    - Standardize on `pino` and `pino-http` for low-overhead logging.
    - Automatically generate and propagate `x-request-id` correlation headers on all Express requests.
    - Format output as structured JSON in production (`NODE_ENV=production`) and pretty human-readable output in development (`NODE_ENV=development`).
    - Use module-scoped child loggers (`logger.child({ module: 'moduleName' })`) for services and repositories.

2. **Tiered Hybrid Rate Limiting (`RateLimiter`)**:
    - Implement a baseline global rate limit on `/api/v1/*` endpoints alongside module-specific strict limiters (e.g. `auth`, `runtime`, `cli`).
    - Support an in-memory store by default with an optional Redis store when `REDIS_URL` is configured in `env.ts`.
    - Key client identities hierarchically: `userId` (when authenticated) > API Key / Token > Client IP (`x-forwarded-for` / `req.ip`).
    - Return standard IETF `RateLimit-*` headers and a unified 429 error payload (`RATE_LIMIT_EXCEEDED` with `retryAfter`).

## Consequences

- Improved observability across HTTP request lifecycles with correlated request IDs.
- Fair quota management for authenticated users regardless of shared IP networks.
- Flexible deployment supporting both single-instance development and distributed Redis-backed production clusters.
