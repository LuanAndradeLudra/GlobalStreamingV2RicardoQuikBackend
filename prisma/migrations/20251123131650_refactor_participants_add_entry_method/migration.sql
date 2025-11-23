-- Create EntryMethod enum
CREATE TYPE "EntryMethod" AS ENUM (
  'BITS',
  'GIFT_SUB',
  'KICK_COINS',
  'SUPERCHAT',
  'TWITCH_TIER_1',
  'TWITCH_TIER_2',
  'TWITCH_TIER_3',
  'TWITCH_NON_SUB',
  'KICK_SUB',
  'KICK_NON_SUB',
  'YOUTUBE_SUB',
  'YOUTUBE_NON_SUB'
);

-- Add new columns to StreamGiveawayParticipant
ALTER TABLE "StreamGiveawayParticipant" ADD COLUMN "method" "EntryMethod" NOT NULL DEFAULT 'TWITCH_NON_SUB'::"EntryMethod";
ALTER TABLE "StreamGiveawayParticipant" ADD COLUMN "metadata" JSONB;

-- Migrate existing data: try to infer method from existing fields
-- For entries with donationAmount > 0, set method to BITS
UPDATE "StreamGiveawayParticipant" 
SET "method" = 'BITS'::"EntryMethod"
WHERE "donationAmount" IS NOT NULL AND "donationAmount" > 0;

-- For entries with isSub = true and subTier = 3, set method to TWITCH_TIER_3
UPDATE "StreamGiveawayParticipant" 
SET "method" = CASE 
  WHEN "platform" = 'TWITCH' AND "isSub" = true AND "subTier" = 3 THEN 'TWITCH_TIER_3'::"EntryMethod"
  WHEN "platform" = 'TWITCH' AND "isSub" = true AND "subTier" = 2 THEN 'TWITCH_TIER_2'::"EntryMethod"
  WHEN "platform" = 'TWITCH' AND "isSub" = true AND "subTier" = 1 THEN 'TWITCH_TIER_1'::"EntryMethod"
  WHEN "platform" = 'TWITCH' AND "isSub" = false THEN 'TWITCH_NON_SUB'::"EntryMethod"
  WHEN "platform" = 'KICK' AND "isSub" = true THEN 'KICK_SUB'::"EntryMethod"
  WHEN "platform" = 'KICK' AND "isSub" = false THEN 'KICK_NON_SUB'::"EntryMethod"
  WHEN "platform" = 'YOUTUBE' AND "isSub" = true THEN 'YOUTUBE_SUB'::"EntryMethod"
  WHEN "platform" = 'YOUTUBE' AND "isSub" = false THEN 'YOUTUBE_NON_SUB'::"EntryMethod"
  ELSE 'TWITCH_NON_SUB'::"EntryMethod"
END
WHERE "method" = 'TWITCH_NON_SUB'::"EntryMethod";

-- Migrate donationAmount to metadata if it exists
UPDATE "StreamGiveawayParticipant" 
SET "metadata" = jsonb_build_object('donationAmount', "donationAmount")
WHERE "donationAmount" IS NOT NULL AND "metadata" IS NULL;

-- Migrate subTier to metadata if it exists
UPDATE "StreamGiveawayParticipant" 
SET "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('subTier', "subTier")
WHERE "subTier" IS NOT NULL;

-- Remove old columns
ALTER TABLE "StreamGiveawayParticipant" DROP COLUMN "isSub";
ALTER TABLE "StreamGiveawayParticipant" DROP COLUMN "subTier";
ALTER TABLE "StreamGiveawayParticipant" DROP COLUMN "donationAmount";

-- Remove old sourceDetails column if it exists (it was Json?)
-- We'll keep it as metadata now, but if sourceDetails had data, merge it
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'StreamGiveawayParticipant' AND column_name = 'sourceDetails') THEN
        UPDATE "StreamGiveawayParticipant" 
        SET "metadata" = COALESCE("metadata", '{}'::jsonb) || COALESCE("sourceDetails"::jsonb, '{}'::jsonb)
        WHERE "sourceDetails" IS NOT NULL;
        
        ALTER TABLE "StreamGiveawayParticipant" DROP COLUMN "sourceDetails";
    END IF;
END $$;

-- Remove default from method column now that data is migrated
ALTER TABLE "StreamGiveawayParticipant" ALTER COLUMN "method" DROP DEFAULT;

-- Add index for querying by method
CREATE INDEX "StreamGiveawayParticipant_streamGiveawayId_externalUserId_method_idx" ON "StreamGiveawayParticipant"("streamGiveawayId", "externalUserId", "method");

