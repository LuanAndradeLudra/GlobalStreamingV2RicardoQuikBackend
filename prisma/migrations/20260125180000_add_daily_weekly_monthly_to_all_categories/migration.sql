-- Add DAILY to KickGiftSubsCategory
ALTER TYPE "KickGiftSubsCategory" ADD VALUE IF NOT EXISTS 'DAILY';

-- Add DAILY to KickCoinsCategory
ALTER TYPE "KickCoinsCategory" ADD VALUE IF NOT EXISTS 'DAILY';

-- Add DAILY, WEEKLY, MONTHLY to TwitchGiftSubsCategory
ALTER TYPE "TwitchGiftSubsCategory" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "TwitchGiftSubsCategory" ADD VALUE IF NOT EXISTS 'WEEKLY';
ALTER TYPE "TwitchGiftSubsCategory" ADD VALUE IF NOT EXISTS 'MONTHLY';

-- Add DAILY to IntegratedBitsKickCoinsCategory
ALTER TYPE "IntegratedBitsKickCoinsCategory" ADD VALUE IF NOT EXISTS 'DAILY';

-- Add DAILY, WEEKLY, MONTHLY to IntegratedGiftSubsCategory
ALTER TYPE "IntegratedGiftSubsCategory" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "IntegratedGiftSubsCategory" ADD VALUE IF NOT EXISTS 'WEEKLY';
ALTER TYPE "IntegratedGiftSubsCategory" ADD VALUE IF NOT EXISTS 'MONTHLY';

