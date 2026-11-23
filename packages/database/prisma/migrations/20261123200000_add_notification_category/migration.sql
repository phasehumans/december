-- Inbox filter (All / Mentions): mentions are replies, review comments and
-- @trydecember mentions from GitHub.
-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationCategory" AS ENUM ('GENERAL', 'MENTION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "category" "NotificationCategory" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_category_isRead_idx" ON "Notification"("userId", "category", "isRead");
