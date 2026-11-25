-- safe to run twice: every statement checks if its object is there already
-- AlterTable: the sign-in (AuthSession) of the browser that turned push on (#636).
-- null for rows from before this field. the row goes when that sign-in is deleted
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "authSessionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_authSessionId_idx" ON "PushSubscription"("authSessionId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_authSessionId_fkey" FOREIGN KEY ("authSessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
