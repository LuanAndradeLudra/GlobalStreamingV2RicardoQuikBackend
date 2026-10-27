-- CreateEnum
CREATE TYPE "VipSource" AS ENUM ('MANUAL', 'INTEGRATION');

-- AlterTable
ALTER TABLE "VipUser" ALTER COLUMN "expiresAt" DROP NOT NULL;
ALTER TABLE "VipUser" ADD COLUMN "email" TEXT;
ALTER TABLE "VipUser" ADD COLUMN "displayName" TEXT;
ALTER TABLE "VipUser" ADD COLUMN "externalId" TEXT;
ALTER TABLE "VipUser" ADD COLUMN "source" "VipSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "VipUser_userId_externalId_key" ON "VipUser"("userId", "externalId");

-- CreateTable
CREATE TABLE "VipIntegrationKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VipIntegrationKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VipIntegrationKey_userId_key" ON "VipIntegrationKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VipIntegrationKey_keyHash_key" ON "VipIntegrationKey"("keyHash");

-- AddForeignKey
ALTER TABLE "VipIntegrationKey" ADD CONSTRAINT "VipIntegrationKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
