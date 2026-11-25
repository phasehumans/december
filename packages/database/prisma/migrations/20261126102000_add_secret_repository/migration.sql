-- #637 section 5: a secret can belong to one repository.
-- repoFullName is 'owner/name', or the empty string for a secret used in all repositories.
-- It is never null: with a null, postgres would keep two "all repositories" rows of one name.
-- Rows that exist today get the empty string, so they stay "all repositories".
ALTER TABLE "Secret" ADD COLUMN IF NOT EXISTS "repoFullName" TEXT NOT NULL DEFAULT '';

-- the new key is made first, so the table is never without a unique key
CREATE UNIQUE INDEX IF NOT EXISTS "Secret_userId_name_repoFullName_key" ON "Secret"("userId", "name", "repoFullName");
DROP INDEX IF EXISTS "Secret_userId_name_key";
