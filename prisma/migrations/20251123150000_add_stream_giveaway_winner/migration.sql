-- CreateEnum
CREATE TYPE "WinnerStatus" AS ENUM ('WINNER', 'REPICK');

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

-- CreateIndex
CREATE INDEX "StreamGiveawayWinner_streamGiveawayId_idx" ON "StreamGiveawayWinner"("streamGiveawayId");

-- CreateIndex
CREATE INDEX "StreamGiveawayWinner_streamGiveawayId_status_idx" ON "StreamGiveawayWinner"("streamGiveawayId", "status");

-- AddForeignKey
ALTER TABLE "StreamGiveawayWinner" ADD CONSTRAINT "StreamGiveawayWinner_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

