-- Fix: Remove platform column from TicketGlobalRule if it still exists
-- This migration ensures the platform column is removed even if previous migrations didn't execute correctly

DO $$
BEGIN
  -- Check if platform column exists and remove it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TicketGlobalRule' AND column_name = 'platform'
  ) THEN
    -- First, ensure we have unique constraint on (userId, role) before removing platform
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'TicketGlobalRule_userId_role_key'
    ) THEN
      -- Drop any existing unique index
      DROP INDEX IF EXISTS "TicketGlobalRule_userId_role_key";
      
      -- Remove duplicates before creating constraint
      DELETE FROM "TicketGlobalRule" t1
      USING "TicketGlobalRule" t2
      WHERE t1.id < t2.id
        AND t1."userId" = t2."userId"
        AND t1."role" = t2."role";
      
      -- Create unique constraint
      ALTER TABLE "TicketGlobalRule" 
        ADD CONSTRAINT "TicketGlobalRule_userId_role_key" UNIQUE ("userId", "role");
    END IF;
    
    -- Drop old unique constraint/index if it exists
    DROP INDEX IF EXISTS "TicketGlobalRule_userId_platform_role_key";
    
    -- Now remove the platform column
    ALTER TABLE "TicketGlobalRule" DROP COLUMN "platform";
  END IF;
END $$;

