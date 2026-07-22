# Glossary & Domain Model

## RepositoryWiki

A documentation structure generated for a user's GitHub repository. Owned by a User and identified by `repoFullName` (e.g. `owner/repo`). Tracks the generation status (`IDLE`, `GENERATING`, `COMPLETED`, `FAILED`) and holds a collection of `WikiPage` entries.

## WikiPage

A single markdown documentation page belonging to a `RepositoryWiki`. Contains a title, URL slug, markdown content, and display order.

## WikiChat

A interactive chat interface embedded within a `RepositoryWiki` viewer. Allows users to submit prompts and ask an AI agent questions specifically grounded in the repository's codebase and wiki documentation.
