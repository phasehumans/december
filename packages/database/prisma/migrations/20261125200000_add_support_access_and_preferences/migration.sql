-- AlterTable
ALTER TABLE "User" ADD COLUMN     "supportAccessUntil" TIMESTAMP(3),
ADD COLUMN     "preferences" JSONB;
