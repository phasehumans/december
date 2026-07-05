-- CreateEnum
CREATE TYPE "DeviceCodeStatus" AS ENUM ('PENDING', 'APPROVED', 'EXPIRED');

-- CreateTable
CREATE TABLE "DeviceCode" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "DeviceCodeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCode_deviceCode_key" ON "DeviceCode"("deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCode_userCode_key" ON "DeviceCode"("userCode");

-- CreateIndex
CREATE INDEX "DeviceCode_deviceCode_idx" ON "DeviceCode"("deviceCode");

-- CreateIndex
CREATE INDEX "DeviceCode_userCode_idx" ON "DeviceCode"("userCode");

-- CreateIndex
CREATE INDEX "DeviceCode_userId_idx" ON "DeviceCode"("userId");

-- AddForeignKey
ALTER TABLE "DeviceCode" ADD CONSTRAINT "DeviceCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
