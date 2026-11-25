-- #637 section 1, the rest of the defaults for a new session: the model of the user's own
-- key (provider and model id), the repository and the base branch.
-- defaultRepository: 'last-used' or a repository full name. defaultBaseBranch: 'default'
-- (the default branch of the repository) or a branch name.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultOwnKeyProvider" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultOwnKeyModel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultRepository" TEXT NOT NULL DEFAULT 'last-used';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultBaseBranch" TEXT NOT NULL DEFAULT 'default';
