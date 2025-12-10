/*
  Warnings:

  - Made the column `allowedRoles` on table `StreamGiveaway` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "KickGiftSubsCategory" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "StreamGiveaway" RENAME CONSTRAINT "Giveaway_pkey" TO "StreamGiveaway_pkey";
ALTER TABLE "StreamGiveaway" ALTER COLUMN "allowedRoles" SET NOT NULL;
ALTER TABLE "StreamGiveaway" ALTER COLUMN "allowedRoles" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StreamGiveawayDonationConfig" RENAME CONSTRAINT "GiveawayDonationConfig_pkey" TO "StreamGiveawayDonationConfig_pkey";

-- AlterTable
ALTER TABLE "StreamGiveawayDonationRuleOverride" RENAME CONSTRAINT "GiveawayDonationRuleOverride_pkey" TO "StreamGiveawayDonationRuleOverride_pkey";

-- AlterTable
ALTER TABLE "StreamGiveawayParticipant" RENAME CONSTRAINT "GiveawayParticipant_pkey" TO "StreamGiveawayParticipant_pkey";

-- AlterTable
ALTER TABLE "StreamGiveawayTicketRuleOverride" RENAME CONSTRAINT "GiveawayTicketRuleOverride_pkey" TO "StreamGiveawayTicketRuleOverride_pkey";

-- DropEnum
DROP TYPE "GiveawayType";

-- CreateTable
CREATE TABLE "KickGiftSubsGiveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "StreamGiveawayStatus" NOT NULL,
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
CREATE INDEX "KickGiftSubsGiveaway_userId_status_idx" ON "KickGiftSubsGiveaway"("userId", "status");

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
ALTER TABLE "KickGiftSubsGiveaway" ADD CONSTRAINT "KickGiftSubsGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickGiftSubsGiveawayParticipant" ADD CONSTRAINT "KickGiftSubsGiveawayParticipant_kickGiftSubsGiveawayId_fkey" FOREIGN KEY ("kickGiftSubsGiveawayId") REFERENCES "KickGiftSubsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickGiftSubsGiveawayWinner" ADD CONSTRAINT "KickGiftSubsGiveawayWinner_kickGiftSubsGiveawayId_fkey" FOREIGN KEY ("kickGiftSubsGiveawayId") REFERENCES "KickGiftSubsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickGiftSubsGiveawayWinner" ADD CONSTRAINT "KickGiftSubsGiveawayWinner_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "KickGiftSubsGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "StreamGiveawayParticipant_streamGiveawayId_externalUserId_metho" RENAME TO "StreamGiveawayParticipant_streamGiveawayId_externalUserId_m_idx";

-- RenameIndex
ALTER INDEX "StreamGiveawayParticipant_streamGiveawayId_platform_externalUse" RENAME TO "StreamGiveawayParticipant_streamGiveawayId_platform_externa_idx";
