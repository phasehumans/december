-- columns and tables nothing reads or writes any more (settings pass, 2026-11-28):
-- the Defaults page, the model source switch, five pull request options, setup commands,
-- the daily digest, support access, admin announcements and redeem code limits were removed.

-- User
ALTER TABLE "User"
    DROP COLUMN "notifyEmail",
    DROP COLUMN "digestEnabled",
    DROP COLUMN "digestTime",
    DROP COLUMN "lastDigestAt",
    DROP COLUMN "defaultModelSource",
    DROP COLUMN "defaultEffort",
    DROP COLUMN "defaultOwnKeyProvider",
    DROP COLUMN "defaultOwnKeyModel",
    DROP COLUMN "defaultRepository",
    DROP COLUMN "defaultBaseBranch",
    DROP COLUMN "supportAccessUntil";

-- PullRequestSettings
ALTER TABLE "PullRequestSettings"
    DROP COLUMN "prCreate",
    DROP COLUMN "archiveOnMerge",
    DROP COLUMN "replyToBots",
    DROP COLUMN "reviewCadence",
    DROP COLUMN "reviewRepos";

-- FeatureWaitlist
ALTER TABLE "FeatureWaitlist" DROP COLUMN "notifiedAt";

-- RedeemCode: codes can no longer be redeemed; old claims still show in the payment history
DROP INDEX IF EXISTS "RedeemCode_codeHash_key";
ALTER TABLE "RedeemCode"
    DROP COLUMN "codeHash",
    DROP COLUMN "maxRedemptions",
    DROP COLUMN "redemptionCount";

-- setup commands
DROP TABLE "RepositorySetting";

-- admin announcements (email goes out through scripts/announce.py)
DROP TABLE "Announcement";
DROP TYPE "AnnouncementKind";
