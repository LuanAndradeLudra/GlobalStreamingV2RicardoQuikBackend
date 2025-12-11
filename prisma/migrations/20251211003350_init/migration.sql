-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ConnectedPlatform" AS ENUM ('TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK');

-- CreateEnum
CREATE TYPE "StreamGiveawayStatus" AS ENUM ('DRAFT', 'OPEN', 'DONE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DonationWindow" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EntryMethod" AS ENUM ('BITS', 'GIFT_SUB', 'KICK_COINS', 'SUPERCHAT', 'TWITCH_TIER_1', 'TWITCH_TIER_2', 'TWITCH_TIER_3', 'TWITCH_NON_SUB', 'KICK_SUB', 'KICK_NON_SUB', 'YOUTUBE_SUB', 'YOUTUBE_NON_SUB');

-- CreateEnum
CREATE TYPE "WinnerStatus" AS ENUM ('WINNER', 'REPICK');

-- CreateEnum
CREATE TYPE "KickGiftSubsCategory" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "provider" "AuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "externalChannelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scopes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketGlobalRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "role" TEXT NOT NULL,
    "ticketsPerUnit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketGlobalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketGlobalDonationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "unitType" TEXT NOT NULL,
    "unitSize" INTEGER NOT NULL,
    "ticketsPerUnitSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketGlobalDonationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamGiveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "StreamGiveawayStatus" NOT NULL,
    "platforms" JSONB NOT NULL,
    "keyword" TEXT NOT NULL,
    "allowedRoles" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamGiveawayTicketRuleOverride" (
    "id" TEXT NOT NULL,
    "streamGiveawayId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ticketsPerUnit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamGiveawayTicketRuleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamGiveawayDonationRuleOverride" (
    "id" TEXT NOT NULL,
    "streamGiveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "unitType" TEXT NOT NULL,
    "unitSize" INTEGER NOT NULL,
    "ticketsPerUnitSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamGiveawayDonationRuleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamGiveawayDonationConfig" (
    "id" TEXT NOT NULL,
    "streamGiveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "unitType" TEXT NOT NULL,
    "donationWindow" "DonationWindow" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamGiveawayDonationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamGiveawayParticipant" (
    "id" TEXT NOT NULL,
    "streamGiveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "method" "EntryMethod" NOT NULL,
    "tickets" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamGiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamGiveawayWinner" (
    "id" TEXT NOT NULL,
    "streamGiveawayId" TEXT NOT NULL,
    "winnerParticipantId" TEXT NOT NULL,
    "status" "WinnerStatus" NOT NULL,
    "participantRanges" JSONB NOT NULL,
    "totalTickets" INTEGER NOT NULL,
    "listHashAlgo" TEXT NOT NULL,
    "listHash" TEXT NOT NULL,
    "randomOrgRandom" JSONB NOT NULL,
    "randomOrgSignature" TEXT NOT NULL,
    "randomOrgVerificationUrl" TEXT NOT NULL,
    "drawnNumber" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamGiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickGiftSubsGiveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "KickGiftSubsCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickGiftSubsGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickGiftSubsGiveawayParticipant" (
    "id" TEXT NOT NULL,
    "kickGiftSubsGiveawayId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickGiftSubsGiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickGiftSubsGiveawayWinner" (
    "id" TEXT NOT NULL,
    "kickGiftSubsGiveawayId" TEXT NOT NULL,
    "winnerParticipantId" TEXT NOT NULL,
    "status" "WinnerStatus" NOT NULL,
    "participantRanges" JSONB NOT NULL,
    "totalTickets" INTEGER NOT NULL,
    "listHashAlgo" TEXT NOT NULL,
    "listHash" TEXT NOT NULL,
    "randomOrgRandom" JSONB NOT NULL,
    "randomOrgSignature" TEXT NOT NULL,
    "randomOrgVerificationUrl" TEXT NOT NULL,
    "drawnNumber" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickGiftSubsGiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_providerId_key" ON "User"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_platform_externalChannelId_key" ON "ConnectedAccount"("platform", "externalChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketGlobalRule_userId_platform_role_key" ON "TicketGlobalRule"("userId", "platform", "role");

-- CreateIndex
CREATE UNIQUE INDEX "TicketGlobalDonationRule_userId_platform_unitType_key" ON "TicketGlobalDonationRule"("userId", "platform", "unitType");

-- CreateIndex
CREATE INDEX "StreamGiveaway_userId_status_idx" ON "StreamGiveaway"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StreamGiveawayTicketRuleOverride_streamGiveawayId_role_key" ON "StreamGiveawayTicketRuleOverride"("streamGiveawayId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "StreamGiveawayDonationRuleOverride_streamGiveawayId_platfor_key" ON "StreamGiveawayDonationRuleOverride"("streamGiveawayId", "platform", "unitType");

-- CreateIndex
CREATE UNIQUE INDEX "StreamGiveawayDonationConfig_streamGiveawayId_platform_unit_key" ON "StreamGiveawayDonationConfig"("streamGiveawayId", "platform", "unitType");

-- CreateIndex
CREATE INDEX "StreamGiveawayParticipant_streamGiveawayId_idx" ON "StreamGiveawayParticipant"("streamGiveawayId");

-- CreateIndex
CREATE INDEX "StreamGiveawayParticipant_streamGiveawayId_platform_externa_idx" ON "StreamGiveawayParticipant"("streamGiveawayId", "platform", "externalUserId");

-- CreateIndex
CREATE INDEX "StreamGiveawayParticipant_streamGiveawayId_externalUserId_m_idx" ON "StreamGiveawayParticipant"("streamGiveawayId", "externalUserId", "method");

-- CreateIndex
CREATE INDEX "StreamGiveawayWinner_streamGiveawayId_idx" ON "StreamGiveawayWinner"("streamGiveawayId");

-- CreateIndex
CREATE INDEX "StreamGiveawayWinner_streamGiveawayId_status_idx" ON "StreamGiveawayWinner"("streamGiveawayId", "status");

-- CreateIndex
CREATE INDEX "StreamGiveawayWinner_winnerParticipantId_idx" ON "StreamGiveawayWinner"("winnerParticipantId");

-- CreateIndex
CREATE INDEX "KickGiftSubsGiveaway_userId_idx" ON "KickGiftSubsGiveaway"("userId");

-- CreateIndex
CREATE INDEX "KickGiftSubsGiveawayParticipant_kickGiftSubsGiveawayId_idx" ON "KickGiftSubsGiveawayParticipant"("kickGiftSubsGiveawayId");

-- CreateIndex
CREATE INDEX "KickGiftSubsGiveawayParticipant_kickGiftSubsGiveawayId_exte_idx" ON "KickGiftSubsGiveawayParticipant"("kickGiftSubsGiveawayId", "externalUserId");

-- CreateIndex
CREATE INDEX "KickGiftSubsGiveawayWinner_kickGiftSubsGiveawayId_idx" ON "KickGiftSubsGiveawayWinner"("kickGiftSubsGiveawayId");

-- CreateIndex
CREATE INDEX "KickGiftSubsGiveawayWinner_kickGiftSubsGiveawayId_status_idx" ON "KickGiftSubsGiveawayWinner"("kickGiftSubsGiveawayId", "status");

-- CreateIndex
CREATE INDEX "KickGiftSubsGiveawayWinner_winnerParticipantId_idx" ON "KickGiftSubsGiveawayWinner"("winnerParticipantId");

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketGlobalRule" ADD CONSTRAINT "TicketGlobalRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketGlobalDonationRule" ADD CONSTRAINT "TicketGlobalDonationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamGiveaway" ADD CONSTRAINT "StreamGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamGiveawayTicketRuleOverride" ADD CONSTRAINT "StreamGiveawayTicketRuleOverride_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamGiveawayDonationRuleOverride" ADD CONSTRAINT "StreamGiveawayDonationRuleOverride_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamGiveawayDonationConfig" ADD CONSTRAINT "StreamGiveawayDonationConfig_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamGiveawayParticipant" ADD CONSTRAINT "StreamGiveawayParticipant_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamGiveawayWinner" ADD CONSTRAINT "StreamGiveawayWinner_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamGiveawayWinner" ADD CONSTRAINT "StreamGiveawayWinner_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "StreamGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickGiftSubsGiveaway" ADD CONSTRAINT "KickGiftSubsGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickGiftSubsGiveawayParticipant" ADD CONSTRAINT "KickGiftSubsGiveawayParticipant_kickGiftSubsGiveawayId_fkey" FOREIGN KEY ("kickGiftSubsGiveawayId") REFERENCES "KickGiftSubsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickGiftSubsGiveawayWinner" ADD CONSTRAINT "KickGiftSubsGiveawayWinner_kickGiftSubsGiveawayId_fkey" FOREIGN KEY ("kickGiftSubsGiveawayId") REFERENCES "KickGiftSubsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickGiftSubsGiveawayWinner" ADD CONSTRAINT "KickGiftSubsGiveawayWinner_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "KickGiftSubsGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
