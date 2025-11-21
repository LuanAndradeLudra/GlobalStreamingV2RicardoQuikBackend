-- Fix: Replace unique index with unique constraint for TicketGlobalRule
-- Prisma needs a UNIQUE CONSTRAINT (not just a UNIQUE INDEX) for upsert operations

-- Drop the existing unique index if it exists
DROP INDEX IF EXISTS "TicketGlobalRule_userId_role_key";

-- Create a unique constraint instead
ALTER TABLE "TicketGlobalRule" 
  ADD CONSTRAINT "TicketGlobalRule_userId_role_key" UNIQUE ("userId", "role");

