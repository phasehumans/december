-- CreateEnum
CREATE TYPE "WikiStatus" AS ENUM ('IDLE', 'GENERATING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "WikiPage" DROP CONSTRAINT IF EXISTS "WikiPage_projectId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "WikiPage_projectId_title_key";

-- AlterTable
ALTER TABLE "WikiPage" DROP COLUMN IF EXISTS "projectId",
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "wikiId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "RepositoryWiki" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "status" "WikiStatus" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryWiki_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepositoryWiki_userId_idx" ON "RepositoryWiki"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryWiki_userId_repoFullName_key" ON "RepositoryWiki"("userId", "repoFullName");

-- CreateIndex
CREATE INDEX "WikiPage_wikiId_idx" ON "WikiPage"("wikiId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_wikiId_slug_key" ON "WikiPage"("wikiId", "slug");

-- AddForeignKey
ALTER TABLE "RepositoryWiki" ADD CONSTRAINT "RepositoryWiki_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_wikiId_fkey" FOREIGN KEY ("wikiId") REFERENCES "RepositoryWiki"("id") ON DELETE CASCADE ON UPDATE CASCADE;
