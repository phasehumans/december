-- #637 section 4, sandbox settings.
-- idleStopMinutes: the sandbox is paused after this many minutes with no activity (10, 30 or 60).
-- archiveAfterDays: sessions not updated for this many days are archived (7 or 30). null: never.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "idleStopMinutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "archiveAfterDays" INTEGER;

-- setup commands for one repository of one user. they run after the clone in a new sandbox.
CREATE TABLE IF NOT EXISTS "RepositorySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "setupCommands" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositorySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RepositorySetting_userId_repoFullName_key" ON "RepositorySetting"("userId", "repoFullName");

DO $$ BEGIN
    ALTER TABLE "RepositorySetting" ADD CONSTRAINT "RepositorySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
