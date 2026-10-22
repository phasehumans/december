-- AlterTable
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "vercelAccessToken",
  DROP COLUMN IF EXISTS "vercelConnected",
  DROP COLUMN IF EXISTS "vercelTeamId",
  DROP COLUMN IF EXISTS "vercelConfigurationId";

-- AlterTable
ALTER TABLE "Session"
  DROP COLUMN IF EXISTS "vercelDeploymentUrl",
  DROP COLUMN IF EXISTS "vercelLastDeployedAt",
  DROP COLUMN IF EXISTS "vercelProjectId",
  DROP COLUMN IF EXISTS "vercelProjectName";
