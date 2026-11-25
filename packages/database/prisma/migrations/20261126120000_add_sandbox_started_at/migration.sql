-- #637 section 4, the "running now" list of the sandbox settings.
-- sandboxStartedAt: when the sandbox of the session last started or resumed. null for a
-- session whose sandbox started before this column.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "sandboxStartedAt" TIMESTAMP(3);
