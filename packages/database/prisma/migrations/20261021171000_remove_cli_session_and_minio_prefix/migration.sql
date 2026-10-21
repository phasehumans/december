/*
  Warnings:

  - The values [CLI] on the enum `SessionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `minioPrefix` on the `Session` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SessionType_new" AS ENUM ('WEB', 'SEARCH');
ALTER TABLE "Session" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "type" TYPE "SessionType_new" USING ("type"::text::"SessionType_new");
ALTER TYPE "SessionType" RENAME TO "SessionType_old";
ALTER TYPE "SessionType_new" RENAME TO "SessionType";
DROP TYPE "SessionType_old";
ALTER TABLE "Session" ALTER COLUMN "type" SET DEFAULT 'WEB';
COMMIT;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "minioPrefix";
