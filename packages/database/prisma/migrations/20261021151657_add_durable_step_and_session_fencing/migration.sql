-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "epoch" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "leaseOwner" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'IDLE';

-- CreateTable
CREATE TABLE "DurableStep" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepType" TEXT NOT NULL,
    "opId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "outputRef" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DurableStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DurableStep_sessionId_idx" ON "DurableStep"("sessionId");

-- CreateIndex
CREATE INDEX "DurableStep_sessionId_opId_idx" ON "DurableStep"("sessionId", "opId");

-- CreateIndex
CREATE UNIQUE INDEX "DurableStep_sessionId_stepIndex_key" ON "DurableStep"("sessionId", "stepIndex");

-- AddForeignKey
ALTER TABLE "DurableStep" ADD CONSTRAINT "DurableStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
