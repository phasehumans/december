/*
  Warnings:

  - You are about to drop the column `stripeCustomerId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `stripePriceId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubscriptionId` on the `Subscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[providerSubscriptionId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerPlanId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerSubscriptionId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `Subscription` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ProviderSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAST_DUE', 'TRIALING', 'UNPAID');

-- DropIndex
DROP INDEX "Subscription_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripePriceId",
DROP COLUMN "stripeSubscriptionId",
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "providerCustomerId" TEXT,
ADD COLUMN     "providerPlanId" TEXT NOT NULL,
ADD COLUMN     "providerSubscriptionId" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ProviderSubscriptionStatus" NOT NULL;

-- DropEnum
DROP TYPE "StripeSubscriptionStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");
