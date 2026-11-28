-- plugins and user hooks saved on the account (connections page)

-- CreateTable
CREATE TABLE "UserPlugin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "version" TEXT,
    "author" TEXT,
    "sourceKind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ref" TEXT,
    "path" TEXT,
    "commitSha" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "mcpServers" JSONB NOT NULL DEFAULT '{}',
    "files" BYTEA,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPlugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserHook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "matcher" TEXT NOT NULL DEFAULT '',
    "command" TEXT NOT NULL,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserHook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPlugin_userId_name_key" ON "UserPlugin"("userId", "name");

-- CreateIndex
CREATE INDEX "UserHook_userId_position_idx" ON "UserHook"("userId", "position");

-- AddForeignKey
ALTER TABLE "UserPlugin" ADD CONSTRAINT "UserPlugin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHook" ADD CONSTRAINT "UserHook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
