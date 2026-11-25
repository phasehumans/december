-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultPlanFirst" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultEffort" TEXT NOT NULL DEFAULT 'deep',
ADD COLUMN     "defaultOpenPullRequest" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "prOpenedAt" TIMESTAMP(3),
ADD COLUMN     "prMergedAt" TIMESTAMP(3),
ADD COLUMN     "prClosedAt" TIMESTAMP(3),
ADD COLUMN     "prCheckedAt" TIMESTAMP(3),
ADD COLUMN     "prAdditions" INTEGER,
ADD COLUMN     "prDeletions" INTEGER;

-- CreateIndex
CREATE INDEX "Session_githubRepoOwner_githubRepoName_prNumber_idx" ON "Session"("githubRepoOwner", "githubRepoName", "prNumber");
