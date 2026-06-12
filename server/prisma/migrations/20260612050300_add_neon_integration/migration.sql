-- AlterTable
ALTER TABLE "User" ADD COLUMN     "neonAccessToken" TEXT,
ADD COLUMN     "neonConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "neonConnectedAt" TIMESTAMP(3),
ADD COLUMN     "neonRefreshToken" TEXT,
ADD COLUMN     "neonTokenExpiresAt" TIMESTAMP(3);
