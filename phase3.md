# Phase 3: December Roadmap & Refactoring Plan

The primary goal of Phase 3 is to overhaul the core data model by transitioning the concept of "Projects" into "Sessions", stripping out legacy features like templates and versioning, and introducing Review, Wiki, and Session settings.

## 1. Database Schema & Migration (`packages/database/prisma/schema.prisma`)

**⚠️ Caution: Breaking Data Migration**
_Renaming models and shifting foreign keys will require a carefully written Prisma migration. This is a breaking change. We must write custom SQL inside the migration file to safely move data from `Project` columns into `Session` columns for any existing users._

- [x] **Simplify the `Project` Model (Folders)**
    - Strip all complex fields and integrations (GitHub, Vercel, Minio). --> move this fields in session
    - Remove fields: `isStarred`, `isFeatured`, `isSharedAsTemplate`, and `ProjectCategory`.
    - Keep basic folder properties: `id`, `name`, `userId`, `createdAt`, `updatedAt`, `description`.
    - Delete `ProjectCategory` Enum, `isSharedAsTemplate`, and `isFeatured` fields completely since Templates are being removed.

- [x] **Enhance the `Session` Model (Primary Workspace)**
    - Transfer complex integrations (GitHub, Vercel, Minio) from `Project` to `Session`.
    - Add new fields: `description`, `isPinned` (boolean), `isArchived` (boolean), `tags` (String array), and `deletedAt` (for soft deletes).
    - Make `projectId` nullable so sessions can exist without a folder (Standalone Sessions).
    - Add `vmStatus` field utilizing a new `VmStatus` enum (`PROVISIONING`, `RUNNING`, `STOPPED`, `FAILED`).
    - Update relations to link to `SessionImport`, `SessionMemory`, `SessionSettings`, and `ReviewComment`.

- [x] **Remove Versioning Models Entirely**
    - Delete `ProjectVersion` model. We do not want rollback features.
    - Delete `ProjectVersionStatus` enum.
    - Remove relations connecting versions to projects or sessions.

- [x] **Rename Associated Models (Foreign Keys)**
    - Rename `ProjectMemory` to `SessionMemory`.
    - Rename `ProjectImport` to `SessionImport`.
    - Rename `ProjectLike` to `SessionLike`. -> remove this like model completely
    - Rename `ProjectCollaborator` to `SessionCollaborator`.
    - Ensure `AgentSessionMemory` explicitly maps to `Session` instead of `Project`.

- [x] **Create New Models**
    - **`SessionSettings`**: Table for flexible configuration (Columns: `id`, `sessionId`, `config` JSON, `createdAt`, `updatedAt`).
    - **`ReviewComment`**: Table for persisting agent and peer reviews (Columns: `id`, `sessionId`, `content`, `prUrl`, `githubCommentId`, `createdAt`, `updatedAt`).
    - **`WikiPage`**: Table for Project-level (folder) documentation (Columns: `id`, `projectId`, `title`, `content`, `createdAt`, `updatedAt`).

## 2. Backend API & Real-time Transport (`apps/server`)

- [ ] **API Endpoint Overhaul**
    - Update all TRPC/REST endpoints to query `Session` instead of `Project` for app data.
    - Remove all versioning-related API routes and logic.

- [ ] **Socket.io Migration**
    - Remove legacy SSE (Server-Sent Events) endpoints in `generate.controller.ts`.
    - Implement WebSocket authentication using JWT handshakes.
    - Configure `@socket.io/redis-adapter` for horizontal scaling across worker nodes.
    - Route all streaming events (`THINKING`, `TOOL_CALL`, `TERMINAL_DATA`) strictly through socket rooms mapped to `sessionId`.

- [ ] **Security & Stability**
    - Implement row-level locking (`SELECT ... FOR UPDATE`) in Postgres when deducting wallet credits to prevent race conditions.
    - Implement Express rate limiting (e.g., 100 req/min) based on `userId`.

- [ ] **GitHub App API**
    - Create dedicated webhooks and endpoints to securely handle interactions coming from the December GitHub App (for Review/PR features).

## 3. Frontend UI Updates (`apps/web`)

- [ ] **Clean Up Legacy UI**
    - Delete the `Projects` page and `Templates` page routes completely.
    - Remove any UI elements related to rolling back or viewing previous session/project versions.

- [ ] **Sessions Hub (`/sessions`)**
    - Convert `/sessions` into the primary landing page.
    - Build a flat list view for all sessions.
    - Implement a search bar and dropdown filters (Tags, Pinned, Archived, Folders/Projects).

- [ ] **Routing Updates**
    - Rename the primary workspace route from `/project/:id` to `/session/:id`.

- [ ] **New Feature Panels**
    - **Review Pane**: Create a UI pane within the Session view specifically to display `ReviewComment`s and PR interactions.
    - **Wiki UI**: Create a project-level (Folder-level) Wiki viewer and editor UI to read and manage `WikiPage` records.
    - **Session Settings Modal**: Add a modal for managing `SessionSettings`, editing tags, pinning/unpinning, archiving, and linking/unlinking the session from a Folder (Project).

## 4. Agent Tools & Logic (`packages/agent`)

- [ ] **Refactor Agent State Management**
    - Remove any agent logic that created or managed project versions.
- [ ] **Wiki Tooling**
    - Implement `read_wiki` tool to allow the agent to fetch folder-level documentation.
    - Implement `update_wiki` tool to allow the agent to autonomously write architectural decisions or guidelines to the DB.

- [ ] **Review & PR Tooling**
    - Implement `create_pr_review` tool for the agent to review user PRs.
    - Implement `submit_pr` tool utilizing the GitHub App integration.

## 5. Manual Setup

- [ ] **Configure GitHub App**
    - Create and configure a dedicated GitHub App in the GitHub Developer Settings.
    - Generate private keys, establish webhook URLs to the new `apps/server` endpoints, and configure necessary OAuth scopes for PR reading/writing.
