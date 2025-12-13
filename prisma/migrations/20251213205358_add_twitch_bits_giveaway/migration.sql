-- CreateEnum
CREATE TYPE "TwitchBitsCategory" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateTable
CREATE TABLE "TwitchBitsGiveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TwitchBitsCategory" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchBitsGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchBitsGiveawayParticipant" (
    "id" TEXT NOT NULL,
    "twitchBitsGiveawayId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "score" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchBitsGiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchBitsGiveawayWinner" (
    "id" TEXT NOT NULL,
    "twitchBitsGiveawayId" TEXT NOT NULL,
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

    CONSTRAINT "TwitchBitsGiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwitchBitsGiveaway_userId_idx" ON "TwitchBitsGiveaway"("userId");

-- CreateIndex
CREATE INDEX "TwitchBitsGiveawayParticipant_twitchBitsGiveawayId_idx" ON "TwitchBitsGiveawayParticipant"("twitchBitsGiveawayId");

-- CreateIndex
CREATE INDEX "TwitchBitsGiveawayParticipant_twitchBitsGiveawayId_external_idx" ON "TwitchBitsGiveawayParticipant"("twitchBitsGiveawayId", "externalUserId");

-- CreateIndex
CREATE INDEX "TwitchBitsGiveawayWinner_twitchBitsGiveawayId_idx" ON "TwitchBitsGiveawayWinner"("twitchBitsGiveawayId");

-- CreateIndex
CREATE INDEX "TwitchBitsGiveawayWinner_twitchBitsGiveawayId_status_idx" ON "TwitchBitsGiveawayWinner"("twitchBitsGiveawayId", "status");

-- CreateIndex
CREATE INDEX "TwitchBitsGiveawayWinner_winnerParticipantId_idx" ON "TwitchBitsGiveawayWinner"("winnerParticipantId");

-- AddForeignKey
ALTER TABLE "TwitchBitsGiveaway" ADD CONSTRAINT "TwitchBitsGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchBitsGiveawayParticipant" ADD CONSTRAINT "TwitchBitsGiveawayParticipant_twitchBitsGiveawayId_fkey" FOREIGN KEY ("twitchBitsGiveawayId") REFERENCES "TwitchBitsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchBitsGiveawayWinner" ADD CONSTRAINT "TwitchBitsGiveawayWinner_twitchBitsGiveawayId_fkey" FOREIGN KEY ("twitchBitsGiveawayId") REFERENCES "TwitchBitsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchBitsGiveawayWinner" ADD CONSTRAINT "TwitchBitsGiveawayWinner_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "TwitchBitsGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
