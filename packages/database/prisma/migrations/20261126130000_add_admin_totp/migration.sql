-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN "adminVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdminTotp" (
    "userId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3),
    "lastUsedStep" INTEGER,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminTotp_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "AdminTotp" ADD CONSTRAINT "AdminTotp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
