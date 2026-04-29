ALTER TABLE "ProjectVersion"
ADD COLUMN IF NOT EXISTS "canvasStateJson" JSONB,
ADD COLUMN IF NOT EXISTS "canvasAssetManifestJson" JSONB;
