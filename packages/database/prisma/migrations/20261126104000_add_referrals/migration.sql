-- #638 section 3, referrals: a code for each user, one referral for each new account, and
-- a wallet transaction type for the two credits. safe on tables with rows: the new column
-- is nullable and nothing is rewritten.

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'REFERRAL';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CREDITED', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Referral" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_inviteeId_key" ON "Referral"("inviteeId");
CREATE INDEX IF NOT EXISTS "Referral_inviterId_status_idx" ON "Referral"("inviterId", "status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
