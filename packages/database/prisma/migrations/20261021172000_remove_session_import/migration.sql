-- DropForeignKey
ALTER TABLE IF EXISTS "SessionImport" DROP CONSTRAINT IF EXISTS "SessionImport_sessionId_fkey";
ALTER TABLE IF EXISTS "SessionImport" DROP CONSTRAINT IF EXISTS "SessionImport_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "SessionImport";

-- DropEnum
DROP TYPE IF EXISTS "ProjectImportSource";
DROP TYPE IF EXISTS "ProjectImportStatus";
