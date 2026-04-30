-- CreateEnum
CREATE TYPE "GenerationSound" AS ENUM ('FIRST_GENERATION', 'ALWAYS', 'NEVER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chatSuggestions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "generationSound" "GenerationSound" NOT NULL DEFAULT 'FIRST_GENERATION';
