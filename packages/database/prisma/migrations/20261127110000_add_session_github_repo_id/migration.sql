-- githubRepoId: the host's id of the repository of the pull request (GitHub repo id or
-- GitLab project id). the pull request webhook matches sessions by it; rows saved before
-- this column have none and still match by owner and name.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "githubRepoId" TEXT;

-- the opened date of rows saved before it was kept: the session date, so the Newest and
-- Oldest sorts and their pages never meet an empty date
UPDATE "Session"
SET "prOpenedAt" = "createdAt"
WHERE "prNumber" IS NOT NULL AND "prOpenedAt" IS NULL;
