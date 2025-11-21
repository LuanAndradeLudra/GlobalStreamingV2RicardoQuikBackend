-- Step 1: Add new columns to TicketGlobalDonationRule with temporary defaults
ALTER TABLE "TicketGlobalDonationRule" 
  ADD COLUMN "unitSize" INTEGER,
  ADD COLUMN "ticketsPerUnitSize" INTEGER;

-- Step 2: Migrate existing data from unitsPerTicket to unitSize and ticketsPerUnitSize
-- For existing rules, we'll set unitSize = unitsPerTicket and ticketsPerUnitSize = 1
-- This maintains the same behavior: X units = 1 ticket
UPDATE "TicketGlobalDonationRule"
SET 
  "unitSize" = "unitsPerTicket",
  "ticketsPerUnitSize" = 1
WHERE "unitSize" IS NULL;

-- Step 3: Make the new columns NOT NULL now that they have values
ALTER TABLE "TicketGlobalDonationRule"
  ALTER COLUMN "unitSize" SET NOT NULL,
  ALTER COLUMN "ticketsPerUnitSize" SET NOT NULL;

-- Step 4: Remove duplicate TicketGlobalRule entries (keep one per userId+role)
-- First, delete duplicates keeping the one with the latest updatedAt
DELETE FROM "TicketGlobalRule" t1
USING "TicketGlobalRule" t2
WHERE t1.id < t2.id
  AND t1."userId" = t2."userId"
  AND t1."role" = t2."role";

-- Step 5: Drop old unique constraint on TicketGlobalRule
DROP INDEX IF EXISTS "TicketGlobalRule_userId_platform_role_key";

-- Step 6: Remove platform column from TicketGlobalRule
ALTER TABLE "TicketGlobalRule" DROP COLUMN "platform";

-- Step 7: Add new unique constraint on TicketGlobalRule (userId, role)
CREATE UNIQUE INDEX "TicketGlobalRule_userId_role_key" ON "TicketGlobalRule"("userId", "role");

-- Step 8: Remove old unitsPerTicket column from TicketGlobalDonationRule
ALTER TABLE "TicketGlobalDonationRule" DROP COLUMN "unitsPerTicket";

