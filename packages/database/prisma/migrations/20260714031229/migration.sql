/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `isRevoked` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `refreshTokenHash` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `revokedAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the `CliSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('WEB', 'CLI', 'SEARCH');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "CliSession" DROP CONSTRAINT "CliSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMessage" DROP CONSTRAINT "ProjectMessage_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMessage" DROP CONSTRAINT "ProjectMessage_projectVersionId_fkey";

-- DropIndex
DROP INDEX "Session_expiresAt_idx";

-- DropIndex
DROP INDEX "Session_refreshTokenHash_key";

-- DropIndex
DROP INDEX "Session_userId_isRevoked_idx";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "expiresAt",
DROP COLUMN "ipAddress",
DROP COLUMN "isRevoked",
DROP COLUMN "refreshTokenHash",
DROP COLUMN "revokedAt",
DROP COLUMN "userAgent",
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" "SessionType" NOT NULL DEFAULT 'WEB';

-- DropTable
DROP TABLE "CliSession";

-- DropTable
DROP TABLE "ProjectMessage";

-- DropEnum
DROP TYPE "ProjectMessageRole";

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "projectVersionId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_isRevoked_idx" ON "AuthSession"("userId", "isRevoked");

-- CreateIndex
CREATE UNIQUE INDEX "Message_sessionId_sequence_key" ON "Message"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "Session_projectId_idx" ON "Session"("projectId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_projectVersionId_fkey" FOREIGN KEY ("projectVersionId") REFERENCES "ProjectVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
