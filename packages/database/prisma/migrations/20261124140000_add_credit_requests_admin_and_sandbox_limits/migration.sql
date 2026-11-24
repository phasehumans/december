-- #624 parts 2 to 4: free credit requests, admin page, and sandbox limits.

-- AlterEnum: free credit grants and manual admin changes
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'GRANT';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';

-- CreateEnum: the sandbox state, apart from the agent run (vmStatus). a paused sandbox
-- does not count toward the running limit
DO $$ BEGIN
    CREATE TYPE "SandboxStatus" AS ENUM ('STARTING', 'RUNNING', 'PAUSED', 'STOPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "sandboxStatus" "SandboxStatus";
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "vmLastActivityAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_sandboxStatus_idx" ON "Session"("userId", "sandboxStatus");
CREATE INDEX IF NOT EXISTS "Session_sandboxStatus_vmLastActivityAt_idx" ON "Session"("sandboxStatus", "vmLastActivityAt");

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CreditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AnnouncementKind" AS ENUM ('ANNOUNCEMENT', 'FEEDBACK_REQUEST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "normalizedEmail" TEXT NOT NULL,
    "status" "CreditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "buildPlan" TEXT NOT NULL,
    "heardFrom" TEXT NOT NULL,
    "agreedToFeedback" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditRequest_normalizedEmail_key" ON "CreditRequest"("normalizedEmail");
CREATE INDEX IF NOT EXISTS "CreditRequest_status_createdAt_idx" ON "CreditRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CreditRequest_userId_idx" ON "CreditRequest"("userId");
CREATE INDEX IF NOT EXISTS "CreditRequest_ipAddress_idx" ON "CreditRequest"("ipAddress");

DO $$ BEGIN
    ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL,
    "kind" "AnnouncementKind" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "signedUpDaysAgo" INTEGER,
    "createdBy" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Announcement_createdAt_idx" ON "Announcement"("createdAt");
