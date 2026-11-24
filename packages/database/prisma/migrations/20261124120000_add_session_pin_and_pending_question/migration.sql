-- Pinned sessions (first in the recent list) and sessions that wait for an answer,
-- so the sessions list can sort, filter and mark them.
-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "pendingQuestionAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_pinnedAt_idx" ON "Session"("userId", "pinnedAt");
