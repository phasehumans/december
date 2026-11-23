-- Coming-soon features (Super Crew first): who asked to be notified, and who
-- already saw the one-time popup.
-- CreateTable
CREATE TABLE IF NOT EXISTS "FeatureWaitlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "popupSeenAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FeatureWaitlist_userId_feature_key" ON "FeatureWaitlist"("userId", "feature");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeatureWaitlist_feature_joinedAt_idx" ON "FeatureWaitlist"("feature", "joinedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FeatureWaitlist" ADD CONSTRAINT "FeatureWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
