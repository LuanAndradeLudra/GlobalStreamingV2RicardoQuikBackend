-- CreateEnum
CREATE TYPE "IntegratedBitsKickCoinsCategory" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "IntegratedBitsKickCoinsGiveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "IntegratedBitsKickCoinsCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegratedBitsKickCoinsGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegratedBitsKickCoinsGiveawayParticipant" (
    "id" TEXT NOT NULL,
    "integratedBitsKickCoinsGiveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "amount" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegratedBitsKickCoinsGiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegratedBitsKickCoinsGiveawayWinner" (
    "id" TEXT NOT NULL,
    "integratedBitsKickCoinsGiveawayId" TEXT NOT NULL,
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

    CONSTRAINT "IntegratedBitsKickCoinsGiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegratedBitsKickCoinsGiveaway_userId_idx" ON "IntegratedBitsKickCoinsGiveaway"("userId");

-- CreateIndex
CREATE INDEX "integrated_bits_kick_participant_giveaway_id_idx" ON "IntegratedBitsKickCoinsGiveawayParticipant"("integratedBitsKickCoinsGiveawayId");

-- CreateIndex
CREATE INDEX "integrated_bits_kick_participant_platform_user_idx" ON "IntegratedBitsKickCoinsGiveawayParticipant"("integratedBitsKickCoinsGiveawayId", "platform", "externalUserId");

-- CreateIndex
CREATE INDEX "integrated_bits_kick_winner_giveaway_id_idx" ON "IntegratedBitsKickCoinsGiveawayWinner"("integratedBitsKickCoinsGiveawayId");

-- CreateIndex
CREATE INDEX "integrated_bits_kick_winner_giveaway_id_status_idx" ON "IntegratedBitsKickCoinsGiveawayWinner"("integratedBitsKickCoinsGiveawayId", "status");

-- CreateIndex
CREATE INDEX "integrated_bits_kick_winner_participant_id_idx" ON "IntegratedBitsKickCoinsGiveawayWinner"("winnerParticipantId");

-- AddForeignKey
ALTER TABLE "IntegratedBitsKickCoinsGiveaway" ADD CONSTRAINT "IntegratedBitsKickCoinsGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegratedBitsKickCoinsGiveawayParticipant" ADD CONSTRAINT "IntegratedBitsKickCoinsGiveawayParticipant_integratedBits_fkey" FOREIGN KEY ("integratedBitsKickCoinsGiveawayId") REFERENCES "IntegratedBitsKickCoinsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegratedBitsKickCoinsGiveawayWinner" ADD CONSTRAINT "IntegratedBitsKickCoinsGiveawayWinner_integratedBitsKick_fkey" FOREIGN KEY ("integratedBitsKickCoinsGiveawayId") REFERENCES "IntegratedBitsKickCoinsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegratedBitsKickCoinsGiveawayWinner" ADD CONSTRAINT "IntegratedBitsKickCoinsGiveawayWinner_winnerParticipantI_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "IntegratedBitsKickCoinsGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;






