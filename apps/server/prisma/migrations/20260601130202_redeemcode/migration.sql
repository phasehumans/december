/*
  Warnings:

  - You are about to drop the `redeem_code_claims` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `redeem_codes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "redeem_code_claims" DROP CONSTRAINT "redeem_code_claims_redeemCodeId_fkey";

-- DropForeignKey
ALTER TABLE "redeem_code_claims" DROP CONSTRAINT "redeem_code_claims_userId_fkey";

-- DropTable
DROP TABLE "redeem_code_claims";

-- DropTable
DROP TABLE "redeem_codes";

-- CreateTable
CREATE TABLE "RedeemCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedeemCodeClaim" (
    "id" TEXT NOT NULL,
    "redeemCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedeemCodeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedeemCode_codeHash_key" ON "RedeemCode"("codeHash");

-- CreateIndex
CREATE INDEX "RedeemCodeClaim_userId_idx" ON "RedeemCodeClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RedeemCodeClaim_redeemCodeId_userId_key" ON "RedeemCodeClaim"("redeemCodeId", "userId");

-- AddForeignKey
ALTER TABLE "RedeemCodeClaim" ADD CONSTRAINT "RedeemCodeClaim_redeemCodeId_fkey" FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedeemCodeClaim" ADD CONSTRAINT "RedeemCodeClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
