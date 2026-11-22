-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BillingSource" AS ENUM ('CREDITS', 'OWN_KEY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "defaultModelSource" "BillingSource" NOT NULL DEFAULT 'CREDITS';

-- AlterTable
ALTER TABLE "UsageEvent"
  ADD COLUMN IF NOT EXISTS "billingSource" "BillingSource" NOT NULL DEFAULT 'CREDITS';

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProviderCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "models" JSONB NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderCredential_userId_provider_key" ON "ProviderCredential"("userId", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProviderCredential_userId_idx" ON "ProviderCredential"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProviderCredential" ADD CONSTRAINT "ProviderCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
