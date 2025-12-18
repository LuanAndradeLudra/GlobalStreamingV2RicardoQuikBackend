-- CreateEnum
CREATE TYPE "IntegratedGiftSubsCategory" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "IntegratedGiftSubsGiveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "IntegratedGiftSubsCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegratedGiftSubsGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegratedGiftSubsGiveawayParticipant" (
    "id" TEXT NOT NULL,
    "integratedGiftSubsGiveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegratedGiftSubsGiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegratedGiftSubsGiveawayWinner" (
    "id" TEXT NOT NULL,
    "integratedGiftSubsGiveawayId" TEXT NOT NULL,
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

    CONSTRAINT "IntegratedGiftSubsGiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegratedGiftSubsGiveaway_userId_idx" ON "IntegratedGiftSubsGiveaway"("userId");

-- CreateIndex
CREATE INDEX "integrated_gift_subs_participant_giveaway_id_idx" ON "IntegratedGiftSubsGiveawayParticipant"("integratedGiftSubsGiveawayId");

-- CreateIndex
CREATE INDEX "integrated_gift_subs_participant_platform_user_idx" ON "IntegratedGiftSubsGiveawayParticipant"("integratedGiftSubsGiveawayId", "platform", "externalUserId");

-- CreateIndex
CREATE INDEX "integrated_gift_subs_winner_giveaway_id_idx" ON "IntegratedGiftSubsGiveawayWinner"("integratedGiftSubsGiveawayId");

-- CreateIndex
CREATE INDEX "integrated_gift_subs_winner_giveaway_id_status_idx" ON "IntegratedGiftSubsGiveawayWinner"("integratedGiftSubsGiveawayId", "status");

-- CreateIndex
CREATE INDEX "integrated_gift_subs_winner_participant_id_idx" ON "IntegratedGiftSubsGiveawayWinner"("winnerParticipantId");

-- AddForeignKey
ALTER TABLE "IntegratedGiftSubsGiveaway" ADD CONSTRAINT "IntegratedGiftSubsGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegratedGiftSubsGiveawayParticipant" ADD CONSTRAINT "IntegratedGiftSubsGiveawayParticipant_integratedGiftSubsGiveawayId_fkey" FOREIGN KEY ("integratedGiftSubsGiveawayId") REFERENCES "IntegratedGiftSubsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegratedGiftSubsGiveawayWinner" ADD CONSTRAINT "IntegratedGiftSubsGiveawayWinner_integratedGiftSubsGiveawayId_fkey" FOREIGN KEY ("integratedGiftSubsGiveawayId") REFERENCES "IntegratedGiftSubsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegratedGiftSubsGiveawayWinner" ADD CONSTRAINT "IntegratedGiftSubsGiveawayWinner_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "IntegratedGiftSubsGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;






