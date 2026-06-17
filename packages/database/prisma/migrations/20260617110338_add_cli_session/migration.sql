-- CreateTable
CREATE TABLE "CliSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "CliSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CliSession_userId_idx" ON "CliSession"("userId");

-- AddForeignKey
ALTER TABLE "CliSession" ADD CONSTRAINT "CliSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
