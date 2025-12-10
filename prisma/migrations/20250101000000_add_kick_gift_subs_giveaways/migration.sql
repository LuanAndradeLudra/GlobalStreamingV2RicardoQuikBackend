-- Ensure StreamGiveawayStatus enum exists (it should already exist, but this ensures it for shadow database)
DO $$ BEGIN
    CREATE TYPE "StreamGiveawayStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'DONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure WinnerStatus enum exists
DO $$ BEGIN
    CREATE TYPE "WinnerStatus" AS ENUM ('WINNER', 'REPICK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
CREATE TYPE "KickGiftSubsCategory" AS ENUM ('WEEKLY', 'MONTHLY');

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
CREATE INDEX "KickGiftSubsGiveawayParticipant_kickGiftSubsGiveawayId_externalUserId_idx" ON "KickGiftSubsGiveawayParticipant"("kickGiftSubsGiveawayId", "externalUserId");

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
