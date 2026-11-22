-- Onboarding is a full-screen flow after sign-in. Every user, new or existing,
-- starts with an empty onboardingCompletedAt, so everyone sees it once.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingStep" TEXT;

-- The old welcome modal and the three home cards are replaced by the flow.
ALTER TABLE "User" DROP COLUMN IF EXISTS "hasCompletedOnboarding";
ALTER TABLE "User" DROP COLUMN IF EXISTS "welcomeCardDone";
ALTER TABLE "User" DROP COLUMN IF EXISTS "githubCardDone";
ALTER TABLE "User" DROP COLUMN IF EXISTS "feedbackCardDone";
