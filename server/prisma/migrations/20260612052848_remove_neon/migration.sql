/*
  Warnings:

  - You are about to drop the column `neonAccessToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `neonConnected` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `neonConnectedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `neonRefreshToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `neonTokenExpiresAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "neonAccessToken",
DROP COLUMN "neonConnected",
DROP COLUMN "neonConnectedAt",
DROP COLUMN "neonRefreshToken",
DROP COLUMN "neonTokenExpiresAt";
