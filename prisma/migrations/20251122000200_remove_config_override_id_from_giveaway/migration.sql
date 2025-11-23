-- Remove unused configOverrideId column from Giveaway table
ALTER TABLE "Giveaway" DROP COLUMN IF EXISTS "configOverrideId";

