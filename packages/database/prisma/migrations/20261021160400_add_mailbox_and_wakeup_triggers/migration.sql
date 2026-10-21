-- CreateTable
CREATE TABLE "MailboxMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "MailboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WakeUpTrigger" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "triggerAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WakeUpTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailboxMessage_sessionId_status_idx" ON "MailboxMessage"("sessionId", "status");

-- CreateIndex
CREATE INDEX "MailboxMessage_status_createdAt_idx" ON "MailboxMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WakeUpTrigger_triggerAt_status_idx" ON "WakeUpTrigger"("triggerAt", "status");

-- CreateIndex
CREATE INDEX "WakeUpTrigger_sessionId_idx" ON "WakeUpTrigger"("sessionId");

-- AddForeignKey
ALTER TABLE "MailboxMessage" ADD CONSTRAINT "MailboxMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WakeUpTrigger" ADD CONSTRAINT "WakeUpTrigger_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
