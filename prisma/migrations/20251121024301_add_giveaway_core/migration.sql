-- CreateEnum
CREATE TYPE "GiveawayType" AS ENUM ('LIVE_KEYWORD', 'SUBS_ONLY', 'DONATION_ONLY', 'INSTAGRAM_COMMENTS', 'TIKTOK_COMMENTS', 'MANUAL');

-- CreateEnum
CREATE TYPE "GiveawayStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GiveawayType" NOT NULL,
    "status" "GiveawayStatus" NOT NULL,
    "platforms" JSONB NOT NULL,
    "keyword" TEXT,
    "configOverrideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayTicketRuleOverride" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "role" TEXT NOT NULL,
    "ticketsPerUnit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiveawayTicketRuleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayParticipant" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "isSub" BOOLEAN NOT NULL,
    "subTier" INTEGER,
    "isGiftSubDonor" BOOLEAN NOT NULL,
    "donationAmount" INTEGER,
    "tickets" INTEGER NOT NULL,
    "sourceDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Giveaway_userId_status_idx" ON "Giveaway"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayTicketRuleOverride_giveawayId_platform_role_key" ON "GiveawayTicketRuleOverride"("giveawayId", "platform", "role");

-- CreateIndex
CREATE INDEX "GiveawayParticipant_giveawayId_idx" ON "GiveawayParticipant"("giveawayId");

-- CreateIndex
CREATE INDEX "GiveawayParticipant_giveawayId_platform_externalUserId_idx" ON "GiveawayParticipant"("giveawayId", "platform", "externalUserId");

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayTicketRuleOverride" ADD CONSTRAINT "GiveawayTicketRuleOverride_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayParticipant" ADD CONSTRAINT "GiveawayParticipant_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
