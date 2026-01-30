-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "EventType" AS ENUM ('BITS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "eventType" "EventType" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_userId_idx" ON "Event"("userId");
CREATE INDEX "Event_userId_platform_idx" ON "Event"("userId", "platform");
CREATE INDEX "Event_userId_platform_eventType_eventDate_idx" ON "Event"("userId", "platform", "eventType", "eventDate");


