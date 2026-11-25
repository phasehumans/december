-- #638 section 1, spend limits: the low balance alert amount, a limit for one session and
-- for one day, and what a "continue" at a limit let through. safe on tables with rows: each
-- new column is nullable or has a default.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lowBalanceAlertCents" INTEGER DEFAULT 100;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lowBalanceAlertedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionLimitCents" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dayLimitCents" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dayLimitAllowanceDay" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dayLimitAllowanceCents" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "limitAllowanceCents" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "limitQuestionKind" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "limitQuestionCents" INTEGER;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "limitHeldRun" JSONB;
