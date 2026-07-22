# 1. GitHub Repository Wiki System & Templates View Replacement

Date: 2026-07-22

## Status

Accepted

## Context

Users need a way to generate, view, edit, and interact with AI-generated documentation (Wikis) for their connected GitHub repositories. Previously, the application included a static Templates view.

## Decision

1. **Replace Templates View with Repository Wikis**:
    - The existing `TemplatesView` and associated templates navigation will be completely replaced by `WikiView` in `apps/web/src/features/wiki`.

2. **Domain & Data Model**:
    - Introduce `RepositoryWiki` schema linked to `User` and identified by `repoFullName` (`repoOwner`/`repoName`).
    - `RepositoryWiki` holds a `1:N` relationship with `WikiPage` (slug, title, markdown content, order).
    - Tracks generation status (`IDLE`, `GENERATING`, `COMPLETED`, `FAILED`).

3. **User Flow & Unconnected State**:
    - If `githubConnected` is false, show a CTA directing the user to connect GitHub via OAuth.
    - Once connected, display all user repositories with generation status badges and "Generate Wiki" / "View Wiki" buttons.

4. **Agent Wiki Generation Stubbing & Chat**:
    - Stub the AI background agent generation: set status to `GENERATING`, populate 3 structured default pages (`Overview`, `Architecture`, `Getting Started`), and update status to `COMPLETED`.
    - Provide full CRUD endpoints for pages (`GET`, `POST`, `PUT`, `DELETE`).
    - Include a `WikiChat` component and `/api/wiki/chat` endpoint allowing users to ask agent questions about the repository wiki.

## Consequences

- Templates feature UI is removed in favor of the new Repository Wiki dashboard.
- Future live AI repo indexers can hook directly into the `POST /api/wiki/generate` endpoint without changing frontend contracts.
