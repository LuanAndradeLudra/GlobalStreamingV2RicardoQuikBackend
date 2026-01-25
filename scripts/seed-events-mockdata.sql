-- ==========================================
-- MOCK DATA for Event Table
-- ==========================================
-- Includes all EventTypes with varied dates for testing DAILY, WEEKLY, MONTHLY periods
-- userId: 720c1d94-6d76-4360-a11c-b14b5236ab7d (adjust if needed)

-- Clear existing data (optional - uncomment if needed)
-- DELETE FROM "Event" WHERE "userId" = '720c1d94-6d76-4360-a11c-b14b5236ab7d';

-- ==========================================
-- TWITCH GIFT_SUBSCRIPTION (Gifters)
-- ==========================================

-- Today's gift subs
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'GIFT_SUBSCRIPTION', '519364023', 'luanandradebxd', 5, NULL, 
   '{"role": "gifter", "tier": "1000", "total": 5, "source": "channel.subscription.gift", "isAnonymous": false, "broadcasterUserId": "68490587"}',
   NOW(), NOW(), NOW()),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'GIFT_SUBSCRIPTION', '1203895119', 'siouf1', 10, NULL,
   '{"role": "gifter", "tier": "1000", "total": 10, "source": "channel.subscription.gift", "isAnonymous": false, "broadcasterUserId": "68490587"}',
   NOW(), NOW(), NOW()),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'GIFT_SUBSCRIPTION', '226582817', 'paulao888', 3, NULL,
   '{"role": "gifter", "tier": "2000", "total": 3, "source": "channel.subscription.gift", "isAnonymous": false, "broadcasterUserId": "68490587"}',
   NOW(), NOW(), NOW());

-- Yesterday's gift subs
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'GIFT_SUBSCRIPTION', '519364023', 'luanandradebxd', 2, NULL,
   '{"role": "gifter", "tier": "1000", "total": 2, "source": "channel.subscription.gift", "isAnonymous": false, "broadcasterUserId": "68490587"}',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'GIFT_SUBSCRIPTION', '275309782', 'anacat', 7, NULL,
   '{"role": "gifter", "tier": "1000", "total": 7, "source": "channel.subscription.gift", "isAnonymous": false, "broadcasterUserId": "68490587"}',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Last week's gift subs
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'GIFT_SUBSCRIPTION', '38038186', 'hiago_murilla', 15, NULL,
   '{"role": "gifter", "tier": "3000", "total": 15, "source": "channel.subscription.gift", "isAnonymous": false, "broadcasterUserId": "68490587"}',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'GIFT_SUBSCRIPTION', '1203895119', 'siouf1', 20, NULL,
   '{"role": "gifter", "tier": "1000", "total": 20, "source": "channel.subscription.gift", "isAnonymous": false, "broadcasterUserId": "68490587"}',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- Last month's gift subs
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'GIFT_SUBSCRIPTION', '519364023', 'luanandradebxd', 25, NULL,
   '{"role": "gifter", "tier": "1000", "total": 25, "source": "channel.subscription.gift", "isAnonymous": false, "broadcasterUserId": "68490587"}',
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days');

-- ==========================================
-- TWITCH SUBSCRIPTION (Receivers)
-- ==========================================

-- Today's subscriptions (received gift subs)
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'SUBSCRIPTION', '226582817', 'paulao888', 0, NULL,
   '{"role": "receiver", "tier": "1000", "isGift": true, "source": "channel.subscribe", "broadcasterUserId": "68490587"}',
   NOW(), NOW(), NOW()),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'SUBSCRIPTION', '275309782', 'anacat', 0, NULL,
   '{"role": "receiver", "tier": "1000", "isGift": true, "source": "channel.subscribe", "broadcasterUserId": "68490587"}',
   NOW(), NOW(), NOW()),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'SUBSCRIPTION', '38038186', 'hiago_murilla', 0, NULL,
   '{"role": "receiver", "tier": "1000", "isGift": false, "source": "channel.subscribe", "broadcasterUserId": "68490587"}',
   NOW(), NOW(), NOW());

-- Yesterday's subscriptions
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'SUBSCRIPTION', '99887766', 'viewer123', 0, NULL,
   '{"role": "receiver", "tier": "2000", "isGift": false, "source": "channel.subscribe", "broadcasterUserId": "68490587"}',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Last week's subscriptions
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'TWITCH', 'SUBSCRIPTION', '55443322', 'oldsubber', 0, NULL,
   '{"role": "receiver", "tier": "3000", "isGift": false, "source": "channel.subscribe", "broadcasterUserId": "68490587"}',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days');

-- ==========================================
-- KICK KICK_COINS
-- ==========================================

-- Today's kick coins
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'KICK_COINS', '70586701', 'LuanAndradeLudra', 500, 'Amazing stream!',
   '{"tier": "MID", "source": "kicks.gifted", "giftName": "Rage Quit", "giftType": "LEVEL_UP", "broadcasterUserId": "69948181", "pinnedTimeSeconds": 600, "broadcasterUsername": "gamerdubrasil"}',
   NOW(), NOW(), NOW()),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'KICK_COINS', '94284232', 'bifrenkiel', 1000, 'Keep it up!',
   '{"tier": "HIGH", "source": "kicks.gifted", "giftName": "Mega Gift", "giftType": "PREMIUM", "broadcasterUserId": "69948181", "pinnedTimeSeconds": 900, "broadcasterUsername": "gamerdubrasil"}',
   NOW(), NOW(), NOW()),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'KICK_COINS', '12345678', 'kickdonor1', 250, NULL,
   '{"tier": "BASIC", "source": "kicks.gifted", "giftName": "Hell Yeah", "giftType": "BASIC", "broadcasterUserId": "69948181", "pinnedTimeSeconds": 0, "broadcasterUsername": "gamerdubrasil"}',
   NOW(), NOW(), NOW());

-- Yesterday's kick coins
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'KICK_COINS', '70586701', 'LuanAndradeLudra', 300, 'GG!',
   '{"tier": "MID", "source": "kicks.gifted", "giftName": "Cool Gift", "giftType": "LEVEL_UP", "broadcasterUserId": "69948181", "pinnedTimeSeconds": 300, "broadcasterUsername": "gamerdubrasil"}',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'KICK_COINS', '23456789', 'kickdonor2', 150, NULL,
   '{"tier": "BASIC", "source": "kicks.gifted", "giftName": "Hype", "giftType": "BASIC", "broadcasterUserId": "69948181", "pinnedTimeSeconds": 0, "broadcasterUsername": "gamerdubrasil"}',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Last week's kick coins
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'KICK_COINS', '94284232', 'bifrenkiel', 800, 'Best streamer!',
   '{"tier": "HIGH", "source": "kicks.gifted", "giftName": "Premium Gift", "giftType": "PREMIUM", "broadcasterUserId": "69948181", "pinnedTimeSeconds": 1200, "broadcasterUsername": "gamerdubrasil"}',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'KICK_COINS', '34567890', 'kickdonor3', 400, NULL,
   '{"tier": "MID", "source": "kicks.gifted", "giftName": "Nice", "giftType": "LEVEL_UP", "broadcasterUserId": "69948181", "pinnedTimeSeconds": 0, "broadcasterUsername": "gamerdubrasil"}',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- Last month's kick coins
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'KICK_COINS', '70586701', 'LuanAndradeLudra', 2000, 'Huge donation!',
   '{"tier": "HIGH", "source": "kicks.gifted", "giftName": "Mega Donation", "giftType": "PREMIUM", "broadcasterUserId": "69948181", "pinnedTimeSeconds": 1800, "broadcasterUsername": "gamerdubrasil"}',
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days');

-- ==========================================
-- KICK GIFT_SUBSCRIPTION (Gifters)
-- ==========================================

-- Today's Kick gift subs
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'GIFT_SUBSCRIPTION', '70586701', 'LuanAndradeLudra', 5, NULL,
   '{"role": "gifter", "total": 5, "source": "channel.subscription.gifts", "isAnonymous": false, "broadcasterUserId": "69948181", "broadcasterUsername": "gamerdubrasil"}',
   NOW(), NOW(), NOW()),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'GIFT_SUBSCRIPTION', '94284232', 'bifrenkiel', 3, NULL,
   '{"role": "gifter", "total": 3, "source": "channel.subscription.gifts", "isAnonymous": false, "broadcasterUserId": "69948181", "broadcasterUsername": "gamerdubrasil"}',
   NOW(), NOW(), NOW());

-- Yesterday's Kick gift subs
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'GIFT_SUBSCRIPTION', '12345678', 'kickgifter1', 10, NULL,
   '{"role": "gifter", "total": 10, "source": "channel.subscription.gifts", "isAnonymous": false, "broadcasterUserId": "69948181", "broadcasterUsername": "gamerdubrasil"}',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Last week's Kick gift subs
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'GIFT_SUBSCRIPTION', '70586701', 'LuanAndradeLudra', 25, NULL,
   '{"role": "gifter", "total": 25, "source": "channel.subscription.gifts", "isAnonymous": false, "broadcasterUserId": "69948181", "broadcasterUsername": "gamerdubrasil"}',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days');

-- ==========================================
-- KICK SUBSCRIPTION (Receivers - New/Renewal)
-- ==========================================

-- Today's Kick subscriptions
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'SUBSCRIPTION', '23456789', 'kicksub1', 0, NULL,
   '{"type": "new", "duration": 1, "source": "channel.subscription.new", "broadcasterUserId": "69948181", "broadcasterUsername": "gamerdubrasil"}',
   NOW(), NOW(), NOW()),
  
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'SUBSCRIPTION', '34567890', 'kicksub2', 0, NULL,
   '{"type": "renewal", "duration": 3, "source": "channel.subscription.renewal", "broadcasterUserId": "69948181", "broadcasterUsername": "gamerdubrasil"}',
   NOW(), NOW(), NOW());

-- Yesterday's Kick subscriptions
INSERT INTO "Event" ("id", "userId", "platform", "eventType", "externalUserId", "username", "amount", "message", "metadata", "eventDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '720c1d94-6d76-4360-a11c-b14b5236ab7d', 'KICK', 'SUBSCRIPTION', '45678901', 'kicksub3', 0, NULL,
   '{"type": "new", "duration": 1, "source": "channel.subscription.new", "broadcasterUserId": "69948181", "broadcasterUsername": "gamerdubrasil"}',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- ==========================================
-- Verification Queries
-- ==========================================

-- Count by event type
-- SELECT "eventType", "platform", COUNT(*) as total
-- FROM "Event"
-- WHERE "userId" = '720c1d94-6d76-4360-a11c-b14b5236ab7d'
-- GROUP BY "eventType", "platform"
-- ORDER BY "platform", "eventType";

-- Count by date range (today, this week, this month)
-- SELECT 
--   'Today' as period,
--   "eventType",
--   "platform",
--   COUNT(*) as total,
--   SUM("amount") as total_amount
-- FROM "Event"
-- WHERE "userId" = '720c1d94-6d76-4360-a11c-b14b5236ab7d'
--   AND "eventDate" >= CURRENT_DATE
-- GROUP BY "eventType", "platform"
-- 
-- UNION ALL
-- 
-- SELECT 
--   'This Week' as period,
--   "eventType",
--   "platform",
--   COUNT(*) as total,
--   SUM("amount") as total_amount
-- FROM "Event"
-- WHERE "userId" = '720c1d94-6d76-4360-a11c-b14b5236ab7d'
--   AND "eventDate" >= date_trunc('week', CURRENT_TIMESTAMP)
-- GROUP BY "eventType", "platform"
-- 
-- UNION ALL
-- 
-- SELECT 
--   'This Month' as period,
--   "eventType",
--   "platform",
--   COUNT(*) as total,
--   SUM("amount") as total_amount
-- FROM "Event"
-- WHERE "userId" = '720c1d94-6d76-4360-a11c-b14b5236ab7d'
--   AND "eventDate" >= date_trunc('month', CURRENT_TIMESTAMP)
-- GROUP BY "eventType", "platform"
-- ORDER BY period, platform, "eventType";

-- View all events
-- SELECT 
--   "eventType",
--   "platform",
--   "username",
--   "amount",
--   "eventDate"::date as date,
--   "metadata"->>'role' as role
-- FROM "Event"
-- WHERE "userId" = '720c1d94-6d76-4360-a11c-b14b5236ab7d'
-- ORDER BY "eventDate" DESC;

-- Test DAILY query (Kick Coins)
-- SELECT 
--   "externalUserId",
--   "username",
--   SUM("amount") as total_coins
-- FROM "Event"
-- WHERE "userId" = '720c1d94-6d76-4360-a11c-b14b5236ab7d'
--   AND "platform" = 'KICK'
--   AND "eventType" = 'KICK_COINS'
--   AND "eventDate" >= CURRENT_DATE
--   AND "eventDate" < CURRENT_DATE + INTERVAL '1 day'
-- GROUP BY "externalUserId", "username"
-- ORDER BY total_coins DESC;

-- Test WEEKLY query (Twitch Gift Subs)
-- SELECT 
--   "externalUserId",
--   "username",
--   SUM("amount") as total_gifts
-- FROM "Event"
-- WHERE "userId" = '720c1d94-6d76-4360-a11c-b14b5236ab7d'
--   AND "platform" = 'TWITCH'
--   AND "eventType" = 'GIFT_SUBSCRIPTION'
--   AND "eventDate" >= date_trunc('week', CURRENT_TIMESTAMP)
--   AND "eventDate" < date_trunc('week', CURRENT_TIMESTAMP) + INTERVAL '1 week'
-- GROUP BY "externalUserId", "username"
-- ORDER BY total_gifts DESC;

