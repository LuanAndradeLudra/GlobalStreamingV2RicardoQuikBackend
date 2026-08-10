-- CreateTable
CREATE TABLE "MonthlyWinLimitConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxWinsPerMonth" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyWinLimitConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyWinExtraWinner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "platformUsername" TEXT NOT NULL,
    "maxWins" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyWinExtraWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyWinLimitConfig_userId_key" ON "MonthlyWinLimitConfig"("userId");

-- CreateIndex
CREATE INDEX "MonthlyWinExtraWinner_userId_idx" ON "MonthlyWinExtraWinner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyWinExtraWinner_userId_platform_platformUsername_key" ON "MonthlyWinExtraWinner"("userId", "platform", "platformUsername");

-- AddForeignKey
ALTER TABLE "MonthlyWinLimitConfig" ADD CONSTRAINT "MonthlyWinLimitConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyWinExtraWinner" ADD CONSTRAINT "MonthlyWinExtraWinner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
