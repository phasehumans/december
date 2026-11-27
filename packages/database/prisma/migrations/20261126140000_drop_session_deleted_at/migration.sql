-- Session.deletedAt was never set: a delete removes the row. the lists filtered on it
-- for nothing, so it goes
ALTER TABLE "Session" DROP COLUMN "deletedAt";
