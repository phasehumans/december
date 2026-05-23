-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vercelAccessToken" TEXT,
ADD COLUMN     "vercelConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vercelEmail" TEXT,
ADD COLUMN     "vercelTeamId" TEXT,
ADD COLUMN     "vercelUserId" TEXT,
ADD COLUMN     "vercelUsername" TEXT;
