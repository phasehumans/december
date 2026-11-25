-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "githubRun" JSONB;

-- CreateTable
CREATE TABLE "PullRequestSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchPrefix" TEXT NOT NULL DEFAULT 'december/',
    "prDraft" BOOLEAN NOT NULL DEFAULT false,
    "prCreate" TEXT NOT NULL DEFAULT 'auto',
    "prAuthor" TEXT NOT NULL DEFAULT 'december',
    "commitAuthor" TEXT NOT NULL DEFAULT 'both',
    "archiveOnMerge" BOOLEAN NOT NULL DEFAULT true,
    "githubCommentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewReplies" TEXT NOT NULL DEFAULT 'mention',
    "replyToBots" BOOLEAN NOT NULL DEFAULT false,
    "fixFailedChecks" BOOLEAN NOT NULL DEFAULT true,
    "autoReview" TEXT NOT NULL DEFAULT 'asked',
    "reviewCadence" TEXT NOT NULL DEFAULT 'once',
    "reviewRepos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestSettings_userId_key" ON "PullRequestSettings"("userId");

-- AddForeignKey
ALTER TABLE "PullRequestSettings" ADD CONSTRAINT "PullRequestSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
