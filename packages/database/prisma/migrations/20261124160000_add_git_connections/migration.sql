-- CreateEnum
CREATE TYPE "GitProvider" AS ENUM ('GITHUB', 'GITLAB');

-- CreateTable
CREATE TABLE "GitConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "GitProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GitConnection_userId_idx" ON "GitConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GitConnection_userId_provider_key" ON "GitConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "GitConnection_provider_externalId_key" ON "GitConnection"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "GitConnection" ADD CONSTRAINT "GitConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

