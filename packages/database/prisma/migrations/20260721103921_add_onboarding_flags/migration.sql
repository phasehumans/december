/*
  Warnings:

  - You are about to drop the column `isPinned` on the `Session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Session" DROP COLUMN "isPinned";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "githubCardDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inviteCardDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "welcomeCardDone" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Secret_userId_idx" ON "Secret"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_userId_name_key" ON "Secret"("userId", "name");

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
