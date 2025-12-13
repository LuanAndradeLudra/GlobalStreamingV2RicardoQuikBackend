-- CreateEnum
CREATE TYPE "KickCoinsCategory" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "KickCoinsGiveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "KickCoinsCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickCoinsGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickCoinsGiveawayParticipant" (
    "id" TEXT NOT NULL,
    "kickCoinsGiveawayId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "giftedAmount" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickCoinsGiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickCoinsGiveawayWinner" (
    "id" TEXT NOT NULL,
    "kickCoinsGiveawayId" TEXT NOT NULL,
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

    CONSTRAINT "KickCoinsGiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KickCoinsGiveaway_userId_idx" ON "KickCoinsGiveaway"("userId");

-- CreateIndex
CREATE INDEX "KickCoinsGiveawayParticipant_kickCoinsGiveawayId_idx" ON "KickCoinsGiveawayParticipant"("kickCoinsGiveawayId");

-- CreateIndex
CREATE INDEX "KickCoinsGiveawayParticipant_kickCoinsGiveawayId_externalUs_idx" ON "KickCoinsGiveawayParticipant"("kickCoinsGiveawayId", "externalUserId");

-- CreateIndex
CREATE INDEX "KickCoinsGiveawayWinner_kickCoinsGiveawayId_idx" ON "KickCoinsGiveawayWinner"("kickCoinsGiveawayId");

-- CreateIndex
CREATE INDEX "KickCoinsGiveawayWinner_kickCoinsGiveawayId_status_idx" ON "KickCoinsGiveawayWinner"("kickCoinsGiveawayId", "status");

-- CreateIndex
CREATE INDEX "KickCoinsGiveawayWinner_winnerParticipantId_idx" ON "KickCoinsGiveawayWinner"("winnerParticipantId");

-- AddForeignKey
ALTER TABLE "KickCoinsGiveaway" ADD CONSTRAINT "KickCoinsGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickCoinsGiveawayParticipant" ADD CONSTRAINT "KickCoinsGiveawayParticipant_kickCoinsGiveawayId_fkey" FOREIGN KEY ("kickCoinsGiveawayId") REFERENCES "KickCoinsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickCoinsGiveawayWinner" ADD CONSTRAINT "KickCoinsGiveawayWinner_kickCoinsGiveawayId_fkey" FOREIGN KEY ("kickCoinsGiveawayId") REFERENCES "KickCoinsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickCoinsGiveawayWinner" ADD CONSTRAINT "KickCoinsGiveawayWinner_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "KickCoinsGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
