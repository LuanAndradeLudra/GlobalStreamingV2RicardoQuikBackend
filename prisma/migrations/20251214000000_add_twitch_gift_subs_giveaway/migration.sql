-- CreateEnum
CREATE TYPE "TwitchGiftSubsCategory" AS ENUM ('ACTIVE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twitchGiftSubsGiveaways" TEXT[];

-- CreateTable
CREATE TABLE "TwitchGiftSubsGiveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TwitchGiftSubsCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchGiftSubsGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchGiftSubsGiveawayParticipant" (
    "id" TEXT NOT NULL,
    "twitchGiftSubsGiveawayId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchGiftSubsGiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchGiftSubsGiveawayWinner" (
    "id" TEXT NOT NULL,
    "twitchGiftSubsGiveawayId" TEXT NOT NULL,
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

    CONSTRAINT "TwitchGiftSubsGiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwitchGiftSubsGiveaway_userId_idx" ON "TwitchGiftSubsGiveaway"("userId");

-- CreateIndex
CREATE INDEX "TwitchGiftSubsGiveawayParticipant_twitchGiftSubsGiveawayId_idx" ON "TwitchGiftSubsGiveawayParticipant"("twitchGiftSubsGiveawayId");

-- CreateIndex
CREATE INDEX "TwitchGiftSubsGiveawayParticipant_twitchGiftSubsGiveawayId_externalUserId_idx" ON "TwitchGiftSubsGiveawayParticipant"("twitchGiftSubsGiveawayId", "externalUserId");

-- CreateIndex
CREATE INDEX "TwitchGiftSubsGiveawayWinner_twitchGiftSubsGiveawayId_idx" ON "TwitchGiftSubsGiveawayWinner"("twitchGiftSubsGiveawayId");

-- CreateIndex
CREATE INDEX "TwitchGiftSubsGiveawayWinner_twitchGiftSubsGiveawayId_status_idx" ON "TwitchGiftSubsGiveawayWinner"("twitchGiftSubsGiveawayId", "status");

-- CreateIndex
CREATE INDEX "TwitchGiftSubsGiveawayWinner_winnerParticipantId_idx" ON "TwitchGiftSubsGiveawayWinner"("winnerParticipantId");

-- AddForeignKey
ALTER TABLE "TwitchGiftSubsGiveaway" ADD CONSTRAINT "TwitchGiftSubsGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchGiftSubsGiveawayParticipant" ADD CONSTRAINT "TwitchGiftSubsGiveawayParticipant_twitchGiftSubsGiveawa_fkey" FOREIGN KEY ("twitchGiftSubsGiveawayId") REFERENCES "TwitchGiftSubsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchGiftSubsGiveawayWinner" ADD CONSTRAINT "TwitchGiftSubsGiveawayWinner_twitchGiftSubsGiveawayId_fkey" FOREIGN KEY ("twitchGiftSubsGiveawayId") REFERENCES "TwitchGiftSubsGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchGiftSubsGiveawayWinner" ADD CONSTRAINT "TwitchGiftSubsGiveawayWinner_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "TwitchGiftSubsGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;











