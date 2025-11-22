-- Add platform column back to TicketGlobalRule
-- NON_SUB must be platform-specific (e.g., NON_SUB for Twitch, NON_SUB for Kick)

-- Step 1: Drop the old unique constraint/index
ALTER TABLE "TicketGlobalRule" DROP CONSTRAINT IF EXISTS "TicketGlobalRule_userId_role_key";
DROP INDEX IF EXISTS "TicketGlobalRule_userId_role_key";

-- Step 2: Add platform column (nullable first, then we'll set defaults)
ALTER TABLE "TicketGlobalRule" 
  ADD COLUMN "platform" "ConnectedPlatform";

-- Step 3: Set default platform based on role (if possible) or use TWITCH as default
-- For roles that are platform-specific, we can infer the platform
UPDATE "TicketGlobalRule"
SET "platform" = CASE
  WHEN "role" LIKE 'TWITCH_%' THEN 'TWITCH'::"ConnectedPlatform"
  WHEN "role" = 'KICK_SUB' THEN 'KICK'::"ConnectedPlatform"
  WHEN "role" = 'YOUTUBE_SUB' THEN 'YOUTUBE'::"ConnectedPlatform"
  ELSE 'TWITCH'::"ConnectedPlatform"  -- Default for NON_SUB and unknown roles
END
WHERE "platform" IS NULL;

-- Step 4: Make platform NOT NULL
ALTER TABLE "TicketGlobalRule"
  ALTER COLUMN "platform" SET NOT NULL;

-- Step 5: Remove duplicates (keep one per userId+platform+role)
DELETE FROM "TicketGlobalRule" t1
USING "TicketGlobalRule" t2
WHERE t1.id < t2.id
  AND t1."userId" = t2."userId"
  AND t1."platform" = t2."platform"
  AND t1."role" = t2."role";

-- Step 6: Create new unique constraint (userId, platform, role)
ALTER TABLE "TicketGlobalRule" 
  ADD CONSTRAINT "TicketGlobalRule_userId_platform_role_key" UNIQUE ("userId", "platform", "role");

