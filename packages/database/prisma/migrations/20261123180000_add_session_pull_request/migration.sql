-- The pull request December opened for a session, so the sessions list and the
-- Pull requests page can show it without reading the worker's Redis cache.
-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "prNumber" INTEGER;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "prUrl" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "prState" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "prTitle" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "prBranch" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_prNumber_idx" ON "Session"("userId", "prNumber");
