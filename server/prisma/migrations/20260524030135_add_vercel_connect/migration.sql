/*
  Warnings:

  - You are about to drop the column `vercelEmail` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `vercelUserId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `vercelUsername` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "vercelEmail",
DROP COLUMN "vercelUserId",
DROP COLUMN "vercelUsername",
ADD COLUMN     "vercelConfigurationId" TEXT;
