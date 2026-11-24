-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "gitProvider" "GitProvider" NOT NULL DEFAULT 'GITHUB';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "gitProvider" "GitProvider" NOT NULL DEFAULT 'GITHUB';

