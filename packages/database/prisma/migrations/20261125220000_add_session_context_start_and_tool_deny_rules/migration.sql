-- AlterTable
ALTER TABLE "User" ADD COLUMN     "toolDenyRules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "contextStartSequence" INTEGER NOT NULL DEFAULT 0;
