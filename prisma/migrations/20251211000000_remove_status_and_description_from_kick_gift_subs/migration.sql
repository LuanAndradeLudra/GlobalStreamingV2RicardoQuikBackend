-- Remove status column from KickGiftSubsGiveaway
ALTER TABLE "KickGiftSubsGiveaway" DROP COLUMN IF EXISTS "status";

-- Remove description column from KickGiftSubsGiveaway
ALTER TABLE "KickGiftSubsGiveaway" DROP COLUMN IF EXISTS "description";

-- Drop index that includes status
DROP INDEX IF EXISTS "KickGiftSubsGiveaway_userId_status_idx";

-- Create new index without status
CREATE INDEX IF NOT EXISTS "KickGiftSubsGiveaway_userId_idx" ON "KickGiftSubsGiveaway"("userId");
