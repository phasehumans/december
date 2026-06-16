-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notionAccessToken" TEXT,
ADD COLUMN     "notionWorkspaceId" TEXT,
ADD COLUMN     "notionWorkspaceName" TEXT,
ADD COLUMN     "supabaseAccessToken" TEXT,
ADD COLUMN     "supabaseConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supabaseConnectedAt" TIMESTAMP(3),
ADD COLUMN     "supabaseRefreshToken" TEXT,
ADD COLUMN     "supabaseTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "supabaseTokenScope" TEXT,
ADD COLUMN     "supabaseUserId" TEXT;
