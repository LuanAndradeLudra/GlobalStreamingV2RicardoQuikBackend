-- AlterEnum
-- Remove 'CUSTOM' from TwitchBitsCategory enum
ALTER TYPE "TwitchBitsCategory" RENAME TO "TwitchBitsCategory_old";
CREATE TYPE "TwitchBitsCategory" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
ALTER TABLE "TwitchBitsGiveaway" ALTER COLUMN "category" TYPE "TwitchBitsCategory" USING ("category"::text::"TwitchBitsCategory");
DROP TYPE "TwitchBitsCategory_old";
