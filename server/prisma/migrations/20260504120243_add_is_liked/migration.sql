/*
  Warnings:

  - Added the required column `isLiked` to the `ProjectLike` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProjectLike" ADD COLUMN     "isLiked" BOOLEAN NOT NULL;
