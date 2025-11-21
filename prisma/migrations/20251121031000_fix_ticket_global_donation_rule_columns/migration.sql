-- Fix: Add missing columns to TicketGlobalDonationRule if they don't exist
-- This migration fixes the case where the previous migration was marked as applied but didn't execute correctly

DO $$
BEGIN
  -- Add unitSize column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TicketGlobalDonationRule' AND column_name = 'unitSize'
  ) THEN
    ALTER TABLE "TicketGlobalDonationRule" ADD COLUMN "unitSize" INTEGER;
    
    -- Migrate existing data from unitsPerTicket to unitSize
    UPDATE "TicketGlobalDonationRule"
    SET "unitSize" = "unitsPerTicket"
    WHERE "unitSize" IS NULL;
    
    -- Make it NOT NULL
    ALTER TABLE "TicketGlobalDonationRule" ALTER COLUMN "unitSize" SET NOT NULL;
  END IF;

  -- Add ticketsPerUnitSize column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TicketGlobalDonationRule' AND column_name = 'ticketsPerUnitSize'
  ) THEN
    ALTER TABLE "TicketGlobalDonationRule" ADD COLUMN "ticketsPerUnitSize" INTEGER;
    
    -- Set default value of 1 for existing records
    UPDATE "TicketGlobalDonationRule"
    SET "ticketsPerUnitSize" = 1
    WHERE "ticketsPerUnitSize" IS NULL;
    
    -- Make it NOT NULL
    ALTER TABLE "TicketGlobalDonationRule" ALTER COLUMN "ticketsPerUnitSize" SET NOT NULL;
  END IF;

  -- Remove unitsPerTicket column if it still exists and the new columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TicketGlobalDonationRule' AND column_name = 'unitsPerTicket'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TicketGlobalDonationRule' AND column_name = 'unitSize'
  ) THEN
    ALTER TABLE "TicketGlobalDonationRule" DROP COLUMN "unitsPerTicket";
  END IF;
END $$;

