/*
  Warnings:

  - You are about to drop the column `starred` on the `Project` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'DEPLOYED', 'FAILED');

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "starred",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isStarred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectStatus" "ProjectStatus" NOT NULL DEFAULT 'DRAFT';
