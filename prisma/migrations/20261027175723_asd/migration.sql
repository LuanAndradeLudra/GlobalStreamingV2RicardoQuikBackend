/*
  Warnings:

  - The values [CUSTOM] on the enum `TwitchBitsCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `twitchGiftSubsGiveaways` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'SUBSCRIPTION';
ALTER TYPE "EventType" ADD VALUE 'GIFT_SUBSCRIPTION';
ALTER TYPE "EventType" ADD VALUE 'KICK_COINS';

-- AlterEnum
BEGIN;
CREATE TYPE "TwitchBitsCategory_new" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');
ALTER TABLE "TwitchBitsGiveaway" ALTER COLUMN "category" TYPE "TwitchBitsCategory_new" USING ("category"::text::"TwitchBitsCategory_new");
ALTER TYPE "TwitchBitsCategory" RENAME TO "TwitchBitsCategory_old";
ALTER TYPE "TwitchBitsCategory_new" RENAME TO "TwitchBitsCategory";
DROP TYPE "TwitchBitsCategory_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "twitchGiftSubsGiveaways";

-- RenameForeignKey
ALTER TABLE "IntegratedBitsKickCoinsGiveawayParticipant" RENAME CONSTRAINT "IntegratedBitsKickCoinsGiveawayParticipant_integratedBits_fkey" TO "IntegratedBitsKickCoinsGiveawayParticipant_integratedBitsK_fkey";

-- RenameForeignKey
ALTER TABLE "IntegratedBitsKickCoinsGiveawayWinner" RENAME CONSTRAINT "IntegratedBitsKickCoinsGiveawayWinner_integratedBitsKick_fkey" TO "IntegratedBitsKickCoinsGiveawayWinner_integratedBitsKickCo_fkey";

-- RenameForeignKey
ALTER TABLE "IntegratedBitsKickCoinsGiveawayWinner" RENAME CONSTRAINT "IntegratedBitsKickCoinsGiveawayWinner_winnerParticipantI_fkey" TO "IntegratedBitsKickCoinsGiveawayWinner_winnerParticipantId_fkey";

-- RenameForeignKey
ALTER TABLE "IntegratedGiftSubsGiveawayParticipant" RENAME CONSTRAINT "IntegratedGiftSubsGiveawayParticipant_integratedGiftSubsGiveawa" TO "IntegratedGiftSubsGiveawayParticipant_integratedGiftSubsGi_fkey";

-- RenameForeignKey
ALTER TABLE "IntegratedGiftSubsGiveawayWinner" RENAME CONSTRAINT "IntegratedGiftSubsGiveawayWinner_integratedGiftSubsGiveawayId_f" TO "IntegratedGiftSubsGiveawayWinner_integratedGiftSubsGiveawa_fkey";

-- RenameForeignKey
ALTER TABLE "TwitchGiftSubsGiveawayParticipant" RENAME CONSTRAINT "TwitchGiftSubsGiveawayParticipant_twitchGiftSubsGiveawa_fkey" TO "TwitchGiftSubsGiveawayParticipant_twitchGiftSubsGiveawayId_fkey";

-- RenameIndex
ALTER INDEX "TwitchGiftSubsGiveawayParticipant_twitchGiftSubsGiveawayId_exte" RENAME TO "TwitchGiftSubsGiveawayParticipant_twitchGiftSubsGiveawayId__idx";

-- RenameIndex
ALTER INDEX "TwitchGiftSubsGiveawayWinner_twitchGiftSubsGiveawayId_status_id" RENAME TO "TwitchGiftSubsGiveawayWinner_twitchGiftSubsGiveawayId_statu_idx";
