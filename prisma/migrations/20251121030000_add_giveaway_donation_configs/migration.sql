-- CreateEnum
CREATE TYPE "DonationWindow" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- Step 1: Add new columns to Giveaway
ALTER TABLE "Giveaway" 
  ADD COLUMN "includeBitsDonors" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "includeGiftSubDonors" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bitsDonationWindow" "DonationWindow",
  ADD COLUMN "giftSubDonationWindow" "DonationWindow";

-- Step 2: Remove platform column from GiveawayTicketRuleOverride
-- First, drop the old unique constraint
DROP INDEX IF EXISTS "GiveawayTicketRuleOverride_giveawayId_platform_role_key";

-- Step 3: Remove duplicate entries (keep one per giveawayId+role)
DELETE FROM "GiveawayTicketRuleOverride" t1
USING "GiveawayTicketRuleOverride" t2
WHERE t1.id < t2.id
  AND t1."giveawayId" = t2."giveawayId"
  AND t1."role" = t2."role";

-- Step 4: Drop platform column
ALTER TABLE "GiveawayTicketRuleOverride" DROP COLUMN "platform";

-- Step 5: Create new unique constraint (giveawayId, role)
CREATE UNIQUE INDEX "GiveawayTicketRuleOverride_giveawayId_role_key" ON "GiveawayTicketRuleOverride"("giveawayId", "role");

