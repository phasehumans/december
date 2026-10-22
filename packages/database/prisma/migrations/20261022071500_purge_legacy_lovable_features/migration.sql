-- DropForeignKey
ALTER TABLE IF EXISTS "SessionCollaborator" DROP CONSTRAINT IF EXISTS "SessionCollaborator_sessionId_fkey";
ALTER TABLE IF EXISTS "SessionCollaborator" DROP CONSTRAINT IF EXISTS "SessionCollaborator_userId_fkey";
ALTER TABLE IF EXISTS "AgentSessionMemory" DROP CONSTRAINT IF EXISTS "AgentSessionMemory_sessionId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "User_username_key";

-- AlterTable
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "username",
  DROP COLUMN IF EXISTS "supabaseAccessToken",
  DROP COLUMN IF EXISTS "supabaseConnected",
  DROP COLUMN IF EXISTS "supabaseConnectedAt",
  DROP COLUMN IF EXISTS "supabaseRefreshToken",
  DROP COLUMN IF EXISTS "supabaseTokenExpiresAt",
  DROP COLUMN IF EXISTS "supabaseTokenScope",
  DROP COLUMN IF EXISTS "supabaseUserId",
  DROP COLUMN IF EXISTS "notionAccessToken",
  DROP COLUMN IF EXISTS "notionWorkspaceId",
  DROP COLUMN IF EXISTS "notionWorkspaceName";

-- DropTable
DROP TABLE IF EXISTS "SessionCollaborator";
DROP TABLE IF EXISTS "AgentSessionMemory";
