-- CreateEnum
CREATE TYPE "NotifyLevel" AS ENUM ('ALL', 'IMPORTANT', 'NONE');

-- AlterTable: the new notification settings (#636)
ALTER TABLE "User" ADD COLUMN     "notifyLevel" "NotifyLevel" NOT NULL DEFAULT 'IMPORTANT',
ADD COLUMN     "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPush" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "digestTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "lastDigestAt" TIMESTAMP(3);

-- notifyProjectActivity had no switch and nothing read it. a user who turned it off
-- keeps "nothing" as the new level, then the column goes
UPDATE "User" SET "notifyLevel" = 'NONE' WHERE "notifyProjectActivity" = false;
ALTER TABLE "User" DROP COLUMN "notifyProjectActivity";

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
