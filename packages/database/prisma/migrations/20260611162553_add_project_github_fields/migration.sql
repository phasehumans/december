-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "githubLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "githubRepoName" TEXT,
ADD COLUMN     "githubRepoOwner" TEXT,
ADD COLUMN     "githubRepoUrl" TEXT;
