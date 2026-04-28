CREATE TYPE "ProjectImportSource" AS ENUM ('GITHUB', 'ZIP');
CREATE TYPE "ProjectImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'UPLOADING', 'STARTING_RUNTIME', 'READY', 'FAILED');

CREATE TABLE "ProjectImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "ProjectImportSource" NOT NULL,
    "sourceUrl" TEXT,
    "sourceFileName" TEXT,
    "bucket" TEXT,
    "objectPrefix" TEXT,
    "status" "ProjectImportStatus" NOT NULL DEFAULT 'PENDING',
    "framework" TEXT,
    "projectId" TEXT,
    "projectVersionId" TEXT,
    "previewUrl" TEXT,
    "errorMessage" TEXT,
    "errorsJson" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectImport_userId_createdAt_idx" ON "ProjectImport"("userId", "createdAt");
CREATE INDEX "ProjectImport_userId_status_idx" ON "ProjectImport"("userId", "status");

ALTER TABLE "ProjectImport" ADD CONSTRAINT "ProjectImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
