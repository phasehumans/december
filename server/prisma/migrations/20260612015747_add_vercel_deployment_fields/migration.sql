-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "vercelDeploymentUrl" TEXT,
ADD COLUMN     "vercelLastDeployedAt" TIMESTAMP(3),
ADD COLUMN     "vercelProjectId" TEXT,
ADD COLUMN     "vercelProjectName" TEXT;
