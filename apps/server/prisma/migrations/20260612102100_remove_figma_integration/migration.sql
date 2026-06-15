-- AlterTable
ALTER TABLE "User" DROP COLUMN "figmaConnected",
DROP COLUMN "figmaAccessToken",
DROP COLUMN "figmaRefreshToken",
DROP COLUMN "figmaTokenExpiresAt",
DROP COLUMN "figmaConnectedAt";
