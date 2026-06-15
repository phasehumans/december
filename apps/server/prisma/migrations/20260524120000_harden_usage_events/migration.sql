-- Backfill existing usage rows into calendar-month billing periods before enforcing period fields.
ALTER TABLE "UsageEvent"
ADD COLUMN "periodStart" TIMESTAMP(3),
ADD COLUMN "periodEnd" TIMESTAMP(3);

UPDATE "UsageEvent"
SET
    "periodStart" = date_trunc('month', "createdAt"),
    "periodEnd" = date_trunc('month', "createdAt") + INTERVAL '1 month'
WHERE "periodStart" IS NULL OR "periodEnd" IS NULL;

ALTER TABLE "UsageEvent"
ALTER COLUMN "periodStart" SET NOT NULL,
ALTER COLUMN "periodEnd" SET NOT NULL;

CREATE UNIQUE INDEX "UsageEvent_externalRequestId_key" ON "UsageEvent"("externalRequestId");
CREATE INDEX "UsageEvent_userId_periodStart_idx" ON "UsageEvent"("userId", "periodStart");
CREATE INDEX "UsageEvent_userId_periodStart_createdAt_idx" ON "UsageEvent"("userId", "periodStart", "createdAt");
CREATE INDEX "UsageEvent_projectId_createdAt_idx" ON "UsageEvent"("projectId", "createdAt");

ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "UsageEvent_userId_idx";
DROP INDEX IF EXISTS "UsageEvent_userId_createdAt_idx";

-- Link imports to generated project records and keep old orphaned rows from blocking deploys.
UPDATE "ProjectImport"
SET "projectId" = NULL
WHERE "projectId" IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM "Project" WHERE "Project"."id" = "ProjectImport"."projectId"
);

UPDATE "ProjectImport"
SET "projectVersionId" = NULL
WHERE "projectVersionId" IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM "ProjectVersion" WHERE "ProjectVersion"."id" = "ProjectImport"."projectVersionId"
);

CREATE INDEX "ProjectImport_projectId_idx" ON "ProjectImport"("projectId");
CREATE INDEX "ProjectImport_projectVersionId_idx" ON "ProjectImport"("projectVersionId");

ALTER TABLE "ProjectImport" ADD CONSTRAINT "ProjectImport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectImport" ADD CONSTRAINT "ProjectImport_projectVersionId_fkey" FOREIGN KEY ("projectVersionId") REFERENCES "ProjectVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add query-path indexes for project lists and public template feeds.
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");
CREATE INDEX "Project_isSharedAsTemplate_updatedAt_idx" ON "Project"("isSharedAsTemplate", "updatedAt");
CREATE INDEX "Project_isSharedAsTemplate_isFeatured_updatedAt_idx" ON "Project"("isSharedAsTemplate", "isFeatured", "updatedAt");
CREATE INDEX "ProjectVersion_projectId_createdAt_idx" ON "ProjectVersion"("projectId", "createdAt");

-- Keep the existing like-row semantics, but make unlike updates observable and liked counts indexed.
ALTER TABLE "ProjectLike" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "ProjectLike" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "ProjectLike" ALTER COLUMN "updatedAt" SET NOT NULL;
CREATE INDEX "ProjectLike_projectId_isLiked_idx" ON "ProjectLike"("projectId", "isLiked");
