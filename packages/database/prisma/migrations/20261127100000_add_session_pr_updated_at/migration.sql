-- prUpdatedAt: the last change of the pull request on the git host. the Pull requests
-- page sorts "Updated" by it, so a merge or a push moves the row up there without moving
-- the session in the Sessions list.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "prUpdatedAt" TIMESTAMP(3);

-- rows saved before this column: the latest date that is known
UPDATE "Session"
SET "prUpdatedAt" = GREATEST("prOpenedAt", "prMergedAt", "prClosedAt", "updatedAt")
WHERE "prNumber" IS NOT NULL AND "prUpdatedAt" IS NULL;
