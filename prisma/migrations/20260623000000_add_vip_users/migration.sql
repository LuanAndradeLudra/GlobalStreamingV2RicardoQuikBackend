-- AlterEnum
ALTER TYPE "EntryMethod" ADD VALUE 'VIP';

-- CreateTable
CREATE TABLE "VipUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "platformUsername" TEXT NOT NULL,
    "bonusTickets" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VipUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VipUser_userId_platform_platformUsername_idx" ON "VipUser"("userId", "platform", "platformUsername");

-- CreateIndex
CREATE INDEX "VipUser_userId_expiresAt_idx" ON "VipUser"("userId", "expiresAt");
