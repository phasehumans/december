-- Sign-in is passwordless (email code, GitHub, Google), so stored password hashes are no longer used.
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";
