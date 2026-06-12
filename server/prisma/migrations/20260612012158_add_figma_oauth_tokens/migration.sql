-- AlterTable
ALTER TABLE "User" ADD COLUMN     "figmaAccessToken" TEXT,
ADD COLUMN     "figmaConnectedAt" TIMESTAMP(3),
ADD COLUMN     "figmaRefreshToken" TEXT,
ADD COLUMN     "figmaTokenExpiresAt" TIMESTAMP(3);
