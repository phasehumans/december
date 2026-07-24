<!-- impeccable:product-schema 1 -->

# PRODUCT.md — December Product Context

## Product Overview

**December** is an AI-powered developer platform and documentation engine that automatically indexes GitHub repositories, generates structured, comprehensive repository wikis, and provides an embedded interactive codebase chat interface (`WikiChat`).

It bridges the gap between complex source code repositories and human understanding through auto-generated architectural guides, real-time code grounding, and developer-first CLI/TUI tools.

---

## Target Audience & Personas

- **Software Engineers & Developers**: Need rapid onboarding to unfamiliar codebases, quick architecture reference, and grounded code navigation.
- **Engineering Managers & Tech Leads**: Want automated, living documentation for team repositories without manual maintenance overhead.
- **Open-Source Maintainers**: Need accessible wiki generation for contributors and community members.
- **Technical Readers**: Seek clear, structured navigation across repository modules, PRDs, and domain concepts.

---

## Core Product Capabilities & Workflows

1. **RepositoryWiki Generation**:
    - Automated ingestion and indexing of GitHub repositories (e.g. `owner/repo`).
    - Generation of structured `WikiPage` entries with hierarchical display order, clear titles, and markdown content.
    - Real-time status tracking (`IDLE`, `GENERATING`, `COMPLETED`, `FAILED`).

2. **WikiChat (Grounded Code Assistant)**:
    - Interactive chat interface embedded inside the repository wiki viewer.
    - Grounded context retrieval against repository source files, domain specs, and generated wikis.

3. **Developer CLI & TUI**:
    - Command-line interfaces (`apps/cli`, `packages/tui`) for local indexing, processing, and terminal interaction.

4. **Enterprise Service Infrastructure**:
    - Tiered `RateLimiter` supporting global and per-module API quotas (in-memory & Redis backends).
    - Pino-based `StructuredLogger` with request correlation (`x-request-id`) and module-scoped child loggers.

---

## Brand Personality & Tone of Voice

- **Technical & Authoritative**: Clean, precise engineering terminology; zero fluff.
- **Developer-Centric & Efficient**: Optimized for speed, keyboard navigation, and high information density.
- **Minimalist & Focused**: Dark-mode aesthetic designed for long coding sessions without visual fatigue.
