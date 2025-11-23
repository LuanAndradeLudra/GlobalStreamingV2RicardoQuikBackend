-- Rename GiveawayStatus enum to StreamGiveawayStatus
ALTER TYPE "GiveawayStatus" RENAME TO "StreamGiveawayStatus";

-- Rename Giveaway table to StreamGiveaway
ALTER TABLE "Giveaway" RENAME TO "StreamGiveaway";

-- Rename GiveawayTicketRuleOverride table to StreamGiveawayTicketRuleOverride
ALTER TABLE "GiveawayTicketRuleOverride" RENAME TO "StreamGiveawayTicketRuleOverride";

-- Rename column giveawayId to streamGiveawayId in StreamGiveawayTicketRuleOverride
ALTER TABLE "StreamGiveawayTicketRuleOverride" RENAME COLUMN "giveawayId" TO "streamGiveawayId";

-- Drop old unique constraint and create new one with renamed column (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayTicketRuleOverride_giveawayId_role_key') THEN
        ALTER TABLE "StreamGiveawayTicketRuleOverride" DROP CONSTRAINT "GiveawayTicketRuleOverride_giveawayId_role_key";
    END IF;
END $$;
ALTER TABLE "StreamGiveawayTicketRuleOverride" ADD CONSTRAINT "StreamGiveawayTicketRuleOverride_streamGiveawayId_role_key" UNIQUE ("streamGiveawayId", "role");

-- Rename foreign key constraint (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayTicketRuleOverride_giveawayId_fkey') THEN
        ALTER TABLE "StreamGiveawayTicketRuleOverride" DROP CONSTRAINT "GiveawayTicketRuleOverride_giveawayId_fkey";
    END IF;
END $$;
ALTER TABLE "StreamGiveawayTicketRuleOverride" ADD CONSTRAINT "StreamGiveawayTicketRuleOverride_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename GiveawayDonationRuleOverride table to StreamGiveawayDonationRuleOverride
ALTER TABLE "GiveawayDonationRuleOverride" RENAME TO "StreamGiveawayDonationRuleOverride";

-- Rename column giveawayId to streamGiveawayId in StreamGiveawayDonationRuleOverride
ALTER TABLE "StreamGiveawayDonationRuleOverride" RENAME COLUMN "giveawayId" TO "streamGiveawayId";

-- Drop old unique constraint and create new one with renamed column (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayDonationRuleOverride_giveawayId_platform_unitType_key') THEN
        ALTER TABLE "StreamGiveawayDonationRuleOverride" DROP CONSTRAINT "GiveawayDonationRuleOverride_giveawayId_platform_unitType_key";
    END IF;
END $$;
ALTER TABLE "StreamGiveawayDonationRuleOverride" ADD CONSTRAINT "StreamGiveawayDonationRuleOverride_streamGiveawayId_platform_unitType_key" UNIQUE ("streamGiveawayId", "platform", "unitType");

-- Rename foreign key constraint (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayDonationRuleOverride_giveawayId_fkey') THEN
        ALTER TABLE "StreamGiveawayDonationRuleOverride" DROP CONSTRAINT "GiveawayDonationRuleOverride_giveawayId_fkey";
    END IF;
END $$;
ALTER TABLE "StreamGiveawayDonationRuleOverride" ADD CONSTRAINT "StreamGiveawayDonationRuleOverride_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename GiveawayDonationConfig table to StreamGiveawayDonationConfig
ALTER TABLE "GiveawayDonationConfig" RENAME TO "StreamGiveawayDonationConfig";

-- Rename column giveawayId to streamGiveawayId in StreamGiveawayDonationConfig
ALTER TABLE "StreamGiveawayDonationConfig" RENAME COLUMN "giveawayId" TO "streamGiveawayId";

-- Drop old unique constraint and create new one with renamed column (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayDonationConfig_giveawayId_platform_unitType_key') THEN
        ALTER TABLE "StreamGiveawayDonationConfig" DROP CONSTRAINT "GiveawayDonationConfig_giveawayId_platform_unitType_key";
    END IF;
END $$;
ALTER TABLE "StreamGiveawayDonationConfig" ADD CONSTRAINT "StreamGiveawayDonationConfig_streamGiveawayId_platform_unitType_key" UNIQUE ("streamGiveawayId", "platform", "unitType");

-- Rename foreign key constraint (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayDonationConfig_giveawayId_fkey') THEN
        ALTER TABLE "StreamGiveawayDonationConfig" DROP CONSTRAINT "GiveawayDonationConfig_giveawayId_fkey";
    END IF;
END $$;
ALTER TABLE "StreamGiveawayDonationConfig" ADD CONSTRAINT "StreamGiveawayDonationConfig_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename GiveawayParticipant table to StreamGiveawayParticipant
ALTER TABLE "GiveawayParticipant" RENAME TO "StreamGiveawayParticipant";

-- Rename column giveawayId to streamGiveawayId in StreamGiveawayParticipant
ALTER TABLE "StreamGiveawayParticipant" RENAME COLUMN "giveawayId" TO "streamGiveawayId";

-- Drop old indexes and create new ones with renamed column
DROP INDEX IF EXISTS "GiveawayParticipant_giveawayId_idx";
DROP INDEX IF EXISTS "GiveawayParticipant_giveawayId_platform_externalUserId_idx";
CREATE INDEX "StreamGiveawayParticipant_streamGiveawayId_idx" ON "StreamGiveawayParticipant"("streamGiveawayId");
CREATE INDEX "StreamGiveawayParticipant_streamGiveawayId_platform_externalUserId_idx" ON "StreamGiveawayParticipant"("streamGiveawayId", "platform", "externalUserId");

-- Rename foreign key constraint (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayParticipant_giveawayId_fkey') THEN
        ALTER TABLE "StreamGiveawayParticipant" DROP CONSTRAINT "GiveawayParticipant_giveawayId_fkey";
    END IF;
END $$;
ALTER TABLE "StreamGiveawayParticipant" ADD CONSTRAINT "StreamGiveawayParticipant_streamGiveawayId_fkey" FOREIGN KEY ("streamGiveawayId") REFERENCES "StreamGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename index on StreamGiveaway table
DROP INDEX IF EXISTS "Giveaway_userId_status_idx";
CREATE INDEX "StreamGiveaway_userId_status_idx" ON "StreamGiveaway"("userId", "status");

-- Rename foreign key constraint in User table (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Giveaway_userId_fkey') THEN
        ALTER TABLE "StreamGiveaway" DROP CONSTRAINT "Giveaway_userId_fkey";
    END IF;
END $$;
ALTER TABLE "StreamGiveaway" ADD CONSTRAINT "StreamGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

