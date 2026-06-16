/*
  Warnings:

  - You are about to drop the column `receiveNotification` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "receiveNotification",
ADD COLUMN     "notifyProductUpdates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyProjectActivity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifySecurityAlerts" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
