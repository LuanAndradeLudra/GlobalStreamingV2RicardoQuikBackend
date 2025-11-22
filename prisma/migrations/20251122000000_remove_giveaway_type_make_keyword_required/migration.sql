-- Remove GiveawayType enum and type field from Giveaway
-- Make keyword required (not nullable)

-- Step 1: Drop the type column from Giveaway
ALTER TABLE "Giveaway" DROP COLUMN IF EXISTS "type";

-- Step 2: Make keyword NOT NULL (first set default for any NULL values, then make it required)
UPDATE "Giveaway" SET "keyword" = '' WHERE "keyword" IS NULL;
ALTER TABLE "Giveaway" ALTER COLUMN "keyword" SET NOT NULL;

-- Step 3: Drop the GiveawayType enum (only if no other tables use it)
-- Note: This will fail if the enum is still referenced elsewhere
-- DROP TYPE IF EXISTS "GiveawayType";

