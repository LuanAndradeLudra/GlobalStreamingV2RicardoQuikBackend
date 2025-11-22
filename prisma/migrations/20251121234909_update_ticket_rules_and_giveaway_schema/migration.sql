-- Update TicketGlobalRule: Remove platform, make it global by role
-- Step 1: Drop the old unique constraint/index
ALTER TABLE "TicketGlobalRule" DROP CONSTRAINT IF EXISTS "TicketGlobalRule_userId_platform_role_key";
DROP INDEX IF EXISTS "TicketGlobalRule_userId_platform_role_key";

-- Step 2: Remove duplicates (keep one per userId+role, preferring the first one)
DELETE FROM "TicketGlobalRule" t1
USING "TicketGlobalRule" t2
WHERE t1.id < t2.id
  AND t1."userId" = t2."userId"
  AND t1."role" = t2."role";

-- Step 3: Drop platform column
ALTER TABLE "TicketGlobalRule" DROP COLUMN IF EXISTS "platform";

-- Step 4: Create new unique constraint (userId, role)
ALTER TABLE "TicketGlobalRule" 
  ADD CONSTRAINT "TicketGlobalRule_userId_role_key" UNIQUE ("userId", "role");

-- Update Giveaway: Add new fields
ALTER TABLE "Giveaway" 
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "allowedRoles" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "includeCoinsDonors" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "includeSuperchatDonors" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "coinsDonationWindow" "DonationWindow",
  ADD COLUMN IF NOT EXISTS "superchatDonationWindow" "DonationWindow";

-- Create GiveawayDonationRuleOverride table
CREATE TABLE IF NOT EXISTS "GiveawayDonationRuleOverride" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "unitType" TEXT NOT NULL,
    "unitSize" INTEGER NOT NULL,
    "ticketsPerUnitSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiveawayDonationRuleOverride_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for GiveawayDonationRuleOverride
CREATE UNIQUE INDEX IF NOT EXISTS "GiveawayDonationRuleOverride_giveawayId_platform_unitType_key" 
ON "GiveawayDonationRuleOverride"("giveawayId", "platform", "unitType");

-- Add foreign key constraint
ALTER TABLE "GiveawayDonationRuleOverride" 
  ADD CONSTRAINT "GiveawayDonationRuleOverride_giveawayId_fkey" 
  FOREIGN KEY ("giveawayId") 
  REFERENCES "Giveaway"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Update GiveawayParticipant: Remove isGiftSubDonor
ALTER TABLE "GiveawayParticipant" DROP COLUMN IF EXISTS "isGiftSubDonor";

