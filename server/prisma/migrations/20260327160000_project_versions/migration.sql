-- CreateEnum
CREATE TYPE "ProjectVersionStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ProjectMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- AlterTable
ALTER TABLE "Project"
ADD COLUMN     "currentVersionId" TEXT,
ADD COLUMN     "versionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProjectVersion" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "sourcePrompt" TEXT NOT NULL,
    "summary" TEXT,
    "status" "ProjectVersionStatus" NOT NULL DEFAULT 'GENERATING',
    "objectStoragePrefix" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "intentJson" JSONB,
    "planJson" JSONB,
    "isDatabaseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "databaseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMessage" (
    "id" TEXT NOT NULL,
    "role" "ProjectMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectVersionId" TEXT NOT NULL,

    CONSTRAINT "ProjectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVersion_projectId_versionNumber_key" ON "ProjectVersion"("projectId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMessage_projectVersionId_sequence_key" ON "ProjectMessage"("projectVersionId", "sequence");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ProjectVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMessage" ADD CONSTRAINT "ProjectMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMessage" ADD CONSTRAINT "ProjectMessage_projectVersionId_fkey" FOREIGN KEY ("projectVersionId") REFERENCES "ProjectVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
