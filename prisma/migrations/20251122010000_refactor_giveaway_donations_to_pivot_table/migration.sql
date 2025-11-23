-- CreateTable
CREATE TABLE "GiveawayDonationConfig" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "unitType" TEXT NOT NULL,
    "donationWindow" "DonationWindow" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiveawayDonationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayDonationConfig_giveawayId_platform_unitType_key" ON "GiveawayDonationConfig"("giveawayId", "platform", "unitType");

-- AddForeignKey
ALTER TABLE "GiveawayDonationConfig" ADD CONSTRAINT "GiveawayDonationConfig_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data
-- Convert includeBitsDonors + bitsDonationWindow to GiveawayDonationConfig
INSERT INTO "GiveawayDonationConfig" ("id", "giveawayId", "platform", "unitType", "donationWindow", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    id,
    'TWITCH',
    'BITS',
    COALESCE("bitsDonationWindow", 'DAILY'),
    "createdAt",
    "updatedAt"
FROM "Giveaway"
WHERE "includeBitsDonors" = true;

-- Convert includeGiftSubDonors + giftSubDonationWindow to GiveawayDonationConfig
-- Twitch Gift Subs
INSERT INTO "GiveawayDonationConfig" ("id", "giveawayId", "platform", "unitType", "donationWindow", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    id,
    'TWITCH',
    'GIFT_SUB',
    COALESCE("giftSubDonationWindow", 'DAILY'),
    "createdAt",
    "updatedAt"
FROM "Giveaway"
WHERE "includeGiftSubDonors" = true AND platforms::jsonb @> '["TWITCH"]'::jsonb;

-- Kick Gift Subs
INSERT INTO "GiveawayDonationConfig" ("id", "giveawayId", "platform", "unitType", "donationWindow", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    id,
    'KICK',
    'GIFT_SUB',
    COALESCE("giftSubDonationWindow", 'DAILY'),
    "createdAt",
    "updatedAt"
FROM "Giveaway"
WHERE "includeGiftSubDonors" = true AND platforms::jsonb @> '["KICK"]'::jsonb;

-- Convert includeCoinsDonors + coinsDonationWindow to GiveawayDonationConfig
INSERT INTO "GiveawayDonationConfig" ("id", "giveawayId", "platform", "unitType", "donationWindow", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    id,
    'KICK',
    'KICK_COINS',
    COALESCE("coinsDonationWindow", 'DAILY'),
    "createdAt",
    "updatedAt"
FROM "Giveaway"
WHERE "includeCoinsDonors" = true;

-- Convert includeSuperchatDonors + superchatDonationWindow to GiveawayDonationConfig
INSERT INTO "GiveawayDonationConfig" ("id", "giveawayId", "platform", "unitType", "donationWindow", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    id,
    'YOUTUBE',
    'SUPERCHAT',
    COALESCE("superchatDonationWindow", 'DAILY'),
    "createdAt",
    "updatedAt"
FROM "Giveaway"
WHERE "includeSuperchatDonors" = true;

-- Drop columns from Giveaway
ALTER TABLE "Giveaway" DROP COLUMN "includeBitsDonors";
ALTER TABLE "Giveaway" DROP COLUMN "includeGiftSubDonors";
ALTER TABLE "Giveaway" DROP COLUMN "includeCoinsDonors";
ALTER TABLE "Giveaway" DROP COLUMN "includeSuperchatDonors";
ALTER TABLE "Giveaway" DROP COLUMN "bitsDonationWindow";
ALTER TABLE "Giveaway" DROP COLUMN "giftSubDonationWindow";
ALTER TABLE "Giveaway" DROP COLUMN "coinsDonationWindow";
ALTER TABLE "Giveaway" DROP COLUMN "superchatDonationWindow";

