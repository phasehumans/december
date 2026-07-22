# AGENTS.md

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues (`phasehumans/december`). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses canonical triage label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

## Testing & Environment

- **Test Environment & DB Setup**: Tests run against `.env.test`.
- **Database Migrations for Tests**: Before running integration or server tests against the test database, deploy test migrations:
    ```bash
    bun --cwd packages/database db:migrate:test
    ```
