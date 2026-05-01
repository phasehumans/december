/*
  Warnings:

  - You are about to drop the column `scheduledDeleteAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "scheduledDeleteAt",
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
