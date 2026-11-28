-- the 90-day purge deletes an account for good. its payment rows stay, with no user
-- AlterTable
ALTER TABLE "WalletTransaction" ALTER COLUMN "userId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "WalletTransaction" DROP CONSTRAINT "WalletTransaction_userId_fkey";

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- an account deleted before deletedAt was saved starts its 90 days now
UPDATE "User" SET "deletedAt" = NOW() WHERE "isDeleted" = true AND "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
