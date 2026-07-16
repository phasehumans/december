/*
  Warnings:

  - You are about to drop the column `projectId` on the `AgentSessionMemory` table. All the data in the column will be lost.
  - You are about to drop the column `versionId` on the `AgentSessionMemory` table. All the data in the column will be lost.
  - You are about to drop the column `projectVersionId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `currentVersionId` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `decemberDeploymentUrl` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `decemberLastDeployedAt` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `githubLastSyncedAt` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `githubRepoName` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `githubRepoOwner` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `githubRepoUrl` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `isFeatured` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `isSharedAsTemplate` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `isStarred` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `previewImageKey` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `projectCategory` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `projectStatus` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `prompt` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `vercelDeploymentUrl` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `vercelLastDeployedAt` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `vercelProjectId` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `vercelProjectName` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `versionCount` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `UsageEvent` table. All the data in the column will be lost.
  - You are about to drop the column `avatarUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `design` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `skills` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Feedback` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectCollaborator` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectImport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectLike` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectMemory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectVersion` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `sessionId` to the `AgentSessionMemory` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VmStatus" AS ENUM ('PROVISIONING', 'RUNNING', 'STOPPED', 'FAILED');

-- DropForeignKey
ALTER TABLE "AgentSessionMemory" DROP CONSTRAINT "AgentSessionMemory_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_projectVersionId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_currentVersionId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectCollaborator" DROP CONSTRAINT "ProjectCollaborator_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectCollaborator" DROP CONSTRAINT "ProjectCollaborator_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectImport" DROP CONSTRAINT "ProjectImport_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectImport" DROP CONSTRAINT "ProjectImport_projectVersionId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectImport" DROP CONSTRAINT "ProjectImport_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectLike" DROP CONSTRAINT "ProjectLike_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectLike" DROP CONSTRAINT "ProjectLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMemory" DROP CONSTRAINT "ProjectMemory_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectVersion" DROP CONSTRAINT "ProjectVersion_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_projectId_fkey";

-- DropForeignKey
ALTER TABLE "UsageEvent" DROP CONSTRAINT "UsageEvent_projectId_fkey";

-- DropForeignKey
ALTER TABLE "UsageEvent" DROP CONSTRAINT "UsageEvent_userId_fkey";

-- DropIndex
DROP INDEX "AgentSessionMemory_projectId_versionId_idx";

-- DropIndex
DROP INDEX "Project_isSharedAsTemplate_isFeatured_updatedAt_idx";

-- DropIndex
DROP INDEX "Project_isSharedAsTemplate_updatedAt_idx";

-- DropIndex
DROP INDEX "UsageEvent_projectId_createdAt_idx";

-- AlterTable
ALTER TABLE "AgentSessionMemory" DROP COLUMN "projectId",
DROP COLUMN "versionId",
ADD COLUMN     "sessionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "projectVersionId";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "currentVersionId",
DROP COLUMN "decemberDeploymentUrl",
DROP COLUMN "decemberLastDeployedAt",
DROP COLUMN "githubLastSyncedAt",
DROP COLUMN "githubRepoName",
DROP COLUMN "githubRepoOwner",
DROP COLUMN "githubRepoUrl",
DROP COLUMN "isFeatured",
DROP COLUMN "isSharedAsTemplate",
DROP COLUMN "isStarred",
DROP COLUMN "previewImageKey",
DROP COLUMN "projectCategory",
DROP COLUMN "projectStatus",
DROP COLUMN "prompt",
DROP COLUMN "vercelDeploymentUrl",
DROP COLUMN "vercelLastDeployedAt",
DROP COLUMN "vercelProjectId",
DROP COLUMN "vercelProjectName",
DROP COLUMN "versionCount";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "githubLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "githubRepoName" TEXT,
ADD COLUMN     "githubRepoOwner" TEXT,
ADD COLUMN     "githubRepoUrl" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minioPrefix" TEXT,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "vercelDeploymentUrl" TEXT,
ADD COLUMN     "vercelLastDeployedAt" TIMESTAMP(3),
ADD COLUMN     "vercelProjectId" TEXT,
ADD COLUMN     "vercelProjectName" TEXT,
ADD COLUMN     "vmId" TEXT,
ADD COLUMN     "vmStatus" "VmStatus" NOT NULL DEFAULT 'STOPPED';

-- AlterTable
ALTER TABLE "UsageEvent" DROP COLUMN "projectId",
ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl",
DROP COLUMN "design",
DROP COLUMN "skills";

-- DropTable
DROP TABLE "Feedback";

-- DropTable
DROP TABLE "ProjectCollaborator";

-- DropTable
DROP TABLE "ProjectImport";

-- DropTable
DROP TABLE "ProjectLike";

-- DropTable
DROP TABLE "ProjectMemory";

-- DropTable
DROP TABLE "ProjectVersion";

-- DropEnum
DROP TYPE "ProjectCategory";

-- DropEnum
DROP TYPE "ProjectStatus";

-- DropEnum
DROP TYPE "ProjectVersionStatus";

-- CreateTable
CREATE TABLE "SessionSettings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "prUrl" TEXT,
    "githubCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionMemory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "sourceType" "ProjectImportSource" NOT NULL,
    "sourceUrl" TEXT,
    "sourceFileName" TEXT,
    "bucket" TEXT,
    "objectPrefix" TEXT,
    "status" "ProjectImportStatus" NOT NULL DEFAULT 'PENDING',
    "framework" TEXT,
    "previewUrl" TEXT,
    "errorMessage" TEXT,
    "errorsJson" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCollaborator" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionSettings_sessionId_key" ON "SessionSettings"("sessionId");

-- CreateIndex
CREATE INDEX "ReviewComment_sessionId_idx" ON "ReviewComment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_projectId_title_key" ON "WikiPage"("projectId", "title");

-- CreateIndex
CREATE INDEX "SessionMemory_sessionId_idx" ON "SessionMemory"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMemory_sessionId_key_key" ON "SessionMemory"("sessionId", "key");

-- CreateIndex
CREATE INDEX "SessionImport_userId_createdAt_idx" ON "SessionImport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionImport_userId_status_idx" ON "SessionImport"("userId", "status");

-- CreateIndex
CREATE INDEX "SessionImport_sessionId_idx" ON "SessionImport"("sessionId");

-- CreateIndex
CREATE INDEX "SessionCollaborator_sessionId_idx" ON "SessionCollaborator"("sessionId");

-- CreateIndex
CREATE INDEX "SessionCollaborator_userId_idx" ON "SessionCollaborator"("userId");

-- CreateIndex
CREATE INDEX "SessionCollaborator_email_idx" ON "SessionCollaborator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCollaborator_sessionId_userId_key" ON "SessionCollaborator"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCollaborator_sessionId_email_key" ON "SessionCollaborator"("sessionId", "email");

-- CreateIndex
CREATE INDEX "AgentSessionMemory_sessionId_idx" ON "AgentSessionMemory"("sessionId");

-- CreateIndex
CREATE INDEX "UsageEvent_sessionId_createdAt_idx" ON "UsageEvent"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSettings" ADD CONSTRAINT "SessionSettings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMemory" ADD CONSTRAINT "SessionMemory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSessionMemory" ADD CONSTRAINT "AgentSessionMemory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionImport" ADD CONSTRAINT "SessionImport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionImport" ADD CONSTRAINT "SessionImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCollaborator" ADD CONSTRAINT "SessionCollaborator_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCollaborator" ADD CONSTRAINT "SessionCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
