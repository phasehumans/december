/*
  Warnings:

  - You are about to drop the column `canvasAssetManifestJson` on the `ProjectVersion` table. All the data in the column will be lost.
  - You are about to drop the column `canvasStateJson` on the `ProjectVersion` table. All the data in the column will be lost.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProjectVersion" DROP COLUMN "canvasAssetManifestJson",
DROP COLUMN "canvasStateJson";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT NOT NULL;
