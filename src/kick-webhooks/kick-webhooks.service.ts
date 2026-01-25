import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StreamGiveawayRedisService } from '../stream-giveaway-redis/stream-giveaway-redis.service';
import { RealtimeGateway } from '../realtime-gateway/realtime-gateway.gateway';
import { KickService } from '../kick/kick.service';
import { GiveawayService } from '../giveaway/giveaway.service';
import { ConnectedPlatform, EntryMethod, DonationWindow } from '@prisma/client';

@Injectable()
export class KickWebhooksService {
  private readonly logger = new Logger(KickWebhooksService.name);
  private readonly kickPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: StreamGiveawayRedisService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly kickService: KickService,
    private readonly giveawayService: GiveawayService,
  ) {}

  /**
   * Parse and validate the RSA public key
   */
  private getPublicKey(): crypto.KeyObject {
    try {
      return crypto.createPublicKey({
        key: this.kickPublicKey,
        format: 'pem',
      });
    } catch (error) {
      this.logger.error('Failed to parse Kick public key:', error);
      throw new Error('Invalid public key configuration');
    }
  }

  /**
   * Verify webhook signature according to Kick's documentation
   * 
   * According to https://docs.kick.com/events/webhook-security:
   * - Signature is created by concatenating: messageId.timestamp.rawBody
   * - Then signed with RSA-SHA256 (PKCS#1 v1.5)
   * - The signature in header is base64 encoded
   * 
   * IMPORTANT: The rawBody must be exactly as received, without any modifications
   */
  verifySignature(
    messageId: string,
    timestamp: string,
    rawBody: string | Buffer,
    signatureB64: string,
  ): boolean {
    try {
      // Convert rawBody to Buffer if it's a string
      const rawBodyBuffer = typeof rawBody === 'string' 
        ? Buffer.from(rawBody, 'utf8') 
        : rawBody;

      // Concat EXACTLY: messageId.timestamp.rawBody (as Buffer, then convert to string)
      // This matches the exact format Kick uses
      const data = Buffer.from(`${messageId}.${timestamp}.${rawBodyBuffer.toString('utf8')}`, 'utf8');

      // Decode base64 signature
      const signature = Buffer.from(signatureB64, 'base64');

      // Get public key
      const publicKey = this.getPublicKey();

      // Verify signature using RSA-SHA256 (PKCS#1 v1.5)
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(data);
      verifier.end();

      const isValid = verifier.verify(publicKey, signature);

      if (!isValid) {
        this.logger.error('❌ [Signature] Verification failed');
        this.logger.error('❌ [Signature] Message ID:', messageId);
      }

      return isValid;
    } catch (error) {
      this.logger.error('❌ [Signature] Verification error:', error);
      this.logger.error('❌ [Signature] Error details:', error instanceof Error ? error.stack : String(error));
      return false;
    }
  }

  /**
   * Process chat message event
   */
  async processChatMessage(event: any): Promise<void> {
    try {
      const message = event.content?.trim() || '';
      const userId = event.sender?.user_id?.toString();
      const username = event.sender?.username;
      const avatarUrl = event.sender?.profile_picture;

      this.logger.log(`👤 [Kick] From: ${username} (ID: ${userId})`);

      if (!message || !userId) {
        this.logger.warn('⚠️ [Kick] Missing required fields');
        return;
      }

      // 1️⃣ Find connected account to get channelId
      // Kick webhooks don't include channelId directly, so we need to find it
      // by searching all KICK connected accounts and matching with active giveaways
      const connectedAccounts = await this.prisma.connectedAccount.findMany({
        where: {
          platform: ConnectedPlatform.KICK,
        },
      });

      if (connectedAccounts.length === 0) {
        return;
      }

      // 2️⃣ Search for active giveaway by keyword in Redis using channelId
      // Try each connected account's channelId until we find a matching giveaway
      let activeGiveaway: any = null;

      for (const account of connectedAccounts) {
        const channelId = account.externalChannelId;
        
        // Use the new Redis service method with channelId
        const giveaway = await this.redisService.findActiveGiveawayByKeyword(
          ConnectedPlatform.KICK,
          channelId,
          message,
        );

        if (giveaway) {
          activeGiveaway = giveaway;
          break;
        }
      }

      if (!activeGiveaway) {
        return;
      }

      // adminUserId vem do activeGiveaway.userId (salvo no Redis)
      const adminUserId = activeGiveaway.userId;

      // 3️⃣ Check if user is subscriber (Kick doesn't have public API for this yet)
      // For now, we'll assume NON_SUB unless we can detect from identity.badges
      let role = 'KICK_NON_SUB';
      let method: EntryMethod = EntryMethod.KICK_NON_SUB;

      // Check if user has subscriber badge
      const badges = event.sender?.identity?.badges || [];
      const isSubscriber = badges.some((badge: any) => badge.type === 'subscriber' || badge.type === 'founder');

      if (isSubscriber) {
        role = 'KICK_SUB';
        method = EntryMethod.KICK_SUB;
      }

      // 4️⃣ Check if role is allowed in this giveaway
      if (!activeGiveaway.allowedRoles.includes(role)) {
        return;
      }

      // 5️⃣ Deduplication check for base role
      const isDuplicateTier = await this.redisService.checkDuplicate(
        activeGiveaway.streamGiveawayId,
        ConnectedPlatform.KICK,
        userId,
        method,
      );

      if (isDuplicateTier) {
        return;
      }

      // ✅ Add entry by TIER/ROLE (if not duplicate)
      if (!isDuplicateTier) {
        // Get ticket configuration for this role
        const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
          streamGiveawayId: activeGiveaway.streamGiveawayId,
          platform: ConnectedPlatform.KICK,
          adminUserId: activeGiveaway.userId,
          role: role,
        });

        if (ticketInfo.totalTickets === 0) {
          this.logger.log(`⚠️ User ${username} has 0 tickets for role ${role} (role not allowed or no rules configured)`);
        } else {
          // Add participant to database (entry by tier/role)
          const participantTier = await this.giveawayService.addParticipant(
            activeGiveaway.userId,
            activeGiveaway.streamGiveawayId,
            {
              platform: ConnectedPlatform.KICK,
              externalUserId: userId,
              username: username,
              avatarUrl: avatarUrl,
              method: method,
              tickets: ticketInfo.totalTickets,
              metadata: {
                role,
                baseTickets: ticketInfo.baseTickets,
              },
            },
          );

          this.logger.log(`✅ [Kick] Participant added: ${username} with ${ticketInfo.totalTickets} tickets (${method})`);

          // Mark participant in Redis
          await this.redisService.markParticipant(
            activeGiveaway.streamGiveawayId,
            ConnectedPlatform.KICK,
            userId,
            method,
          );

          // Increment metrics
          await this.redisService.incrementMetric(
            activeGiveaway.streamGiveawayId,
            'total_participants',
          );

          // Broadcast to frontend
          this.realtimeGateway.emitParticipantAdded({
            streamGiveawayId: activeGiveaway.streamGiveawayId,
            participant: {
              id: participantTier.id,
              username: participantTier.username,
              platform: participantTier.platform,
              method: participantTier.method,
              tickets: participantTier.tickets,
              avatarUrl: participantTier.avatarUrl || undefined,
            },
          });
        }
      }

      // 🔟 Check for donation configs (Kick Coins and Gift Subs)
      const kickCoinsConfig = activeGiveaway.donationConfigs.find(
        (config: any) => config.platform === ConnectedPlatform.KICK && config.unitType === 'KICK_COINS',
      );

      if (kickCoinsConfig) {
        // Check if already added for KICK_COINS
        const isKickCoinsDuplicate = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.KICK,
          userId,
          EntryMethod.KICK_COINS,
        );

        if (!isKickCoinsDuplicate) {
          
          const kickCoins = await this.getKickCoinsForUser(
            activeGiveaway.userId,
            parseInt(userId),
            kickCoinsConfig.donationWindow as DonationWindow,
          );

          if (kickCoins > 0) {

            // Calculate tickets for KICK_COINS (ONLY donation, no base role tickets)
            const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
              streamGiveawayId: activeGiveaway.streamGiveawayId,
              platform: ConnectedPlatform.KICK,
              adminUserId: activeGiveaway.userId,
              role: 'NON_SUB', // Use NON_SUB to ensure baseTickets = 0
              totalKickCoins: kickCoins, // Use totalKickCoins param for Kick Coins
            });

            // For donation-only entries, use ONLY the kick coins tickets, ignore base tickets
            const coinsTickets = ticketInfo.kickCoinsTickets;

            if (coinsTickets > 0) {
              // Create separate entry for KICK_COINS
              const coinsParticipant = await this.giveawayService.addParticipant(
                activeGiveaway.userId,
                activeGiveaway.streamGiveawayId,
                {
                  platform: ConnectedPlatform.KICK,
                  externalUserId: userId,
                  username: username,
                  avatarUrl: avatarUrl,
                  method: EntryMethod.KICK_COINS,
                  tickets: coinsTickets,
                  metadata: {
                    role,
                    kickCoins: kickCoins,
                    baseTickets: ticketInfo.baseTickets,
                    kickCoinsTickets: ticketInfo.kickCoinsTickets,
                  },
                },
              );

              this.logger.log(`✅ [Kick] KICK_COINS entry added: ${coinsTickets} tickets for ${kickCoins} coins`);

              await this.redisService.markParticipant(
                activeGiveaway.streamGiveawayId,
                ConnectedPlatform.KICK,
                userId,
                EntryMethod.KICK_COINS,
              );

              this.realtimeGateway.emitParticipantAdded({
                streamGiveawayId: activeGiveaway.streamGiveawayId,
                participant: {
                  id: coinsParticipant.id,
                  username: coinsParticipant.username,
                  platform: coinsParticipant.platform,
                  method: coinsParticipant.method,
                  tickets: coinsParticipant.tickets,
                  avatarUrl: coinsParticipant.avatarUrl || undefined,
                },
              });
            }
          }
        }
      }

      // Check for Gift Subs
      const giftSubConfig = activeGiveaway.donationConfigs.find(
        (config: any) => config.platform === ConnectedPlatform.KICK && config.unitType === 'GIFT_SUB',
      );

      if (giftSubConfig) {
        const isGiftSubDuplicate = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.KICK,
          userId,
          EntryMethod.GIFT_SUB,
        );

        if (!isGiftSubDuplicate) {
          const giftSubs = await this.getGiftSubsForUser(
            activeGiveaway.userId,
            parseInt(userId),
            username,
            giftSubConfig.donationWindow as DonationWindow,
          );

          if (giftSubs > 0) {

            // Calculate tickets for GIFT_SUB (ONLY donation, no base role tickets)
            const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
              streamGiveawayId: activeGiveaway.streamGiveawayId,
              platform: ConnectedPlatform.KICK,
              adminUserId: activeGiveaway.userId,
              role: 'NON_SUB', // Use NON_SUB to ensure baseTickets = 0
              totalGiftSubs: giftSubs,
            });

            // For donation-only entries, use ONLY the gift tickets, ignore base tickets
            const giftTickets = ticketInfo.giftTickets;

            if (giftTickets > 0) {
              const giftParticipant = await this.giveawayService.addParticipant(
                activeGiveaway.userId,
                activeGiveaway.streamGiveawayId,
                {
                  platform: ConnectedPlatform.KICK,
                  externalUserId: userId,
                  username: username,
                  avatarUrl: avatarUrl,
                  method: EntryMethod.GIFT_SUB,
                  tickets: giftTickets,
                  metadata: {
                    role,
                    giftSubs: giftSubs,
                    baseTickets: ticketInfo.baseTickets,
                    giftTickets: ticketInfo.giftTickets,
                  },
                },
              );

              this.logger.log(`✅ [Kick] GIFT_SUB entry added: ${giftTickets} tickets for ${giftSubs} subs`);

              await this.redisService.markParticipant(
                activeGiveaway.streamGiveawayId,
                ConnectedPlatform.KICK,
                userId,
                EntryMethod.GIFT_SUB,
              );

              this.realtimeGateway.emitParticipantAdded({
                streamGiveawayId: activeGiveaway.streamGiveawayId,
                participant: {
                  id: giftParticipant.id,
                  username: giftParticipant.username,
                  platform: giftParticipant.platform,
                  method: giftParticipant.method,
                  tickets: giftParticipant.tickets,
                  avatarUrl: giftParticipant.avatarUrl || undefined,
                },
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('❌ [Kick] Error processing chat message:', error);
    }
  }

  /**
   * Process subscription event
   */
  async processSubscription(event: any): Promise<void> {
    this.logger.log('🎁 [Kick Webhook] Subscription event received');
    this.logger.log('📝 [Kick Webhook] Subscription details:', JSON.stringify(event, null, 2));
  }

  /**
   * Process kicks gifted event
   * Webhook event type: kicks.gifted
   * Saves Kick Coins donations to the Event table
   */
  async processKicksGifted(event: any): Promise<void> {
    this.logger.log('💰 [Kick Coins] Processing kicks gifted event...');
    this.logger.log(`📝 [Kick Coins] Event: ${JSON.stringify(event, null, 2)}`);

    try {
      const broadcasterUserId = event.broadcaster?.user_id?.toString();
      const broadcasterUsername = event.broadcaster?.username;
      const senderUserId = event.sender?.user_id?.toString();
      const senderUsername = event.sender?.username;
      const amount = event.gift?.amount; // Quantidade de Kick Coins
      const giftName = event.gift?.name;
      const giftType = event.gift?.type;
      const tier = event.gift?.tier;
      const message = event.gift?.message || '';

      this.logger.log(`💰 [Kick Coins] Parsed: broadcaster=${broadcasterUserId}, sender=${senderUserId}, username=${senderUsername}, amount=${amount}`);

      if (!broadcasterUserId || !senderUserId || !senderUsername || !amount) {
        this.logger.warn('⚠️ [Kick Coins] Missing required fields');
        return;
      }

      // Find connected account
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.KICK,
          externalChannelId: broadcasterUserId,
        },
      });

      if (!connectedAccount) {
        this.logger.warn(`⚠️ [Kick Coins] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      this.logger.log(`✅ [Kick Coins] Found connected account for user ${connectedAccount.userId}`);

      // Save event to database
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.KICK,
          eventType: 'KICK_COINS',
          externalUserId: senderUserId,
          username: senderUsername,
          amount: amount,
          message: message,
          metadata: {
            broadcasterUserId,
            broadcasterUsername,
            giftName,
            giftType,
            tier,
            pinnedTimeSeconds: event.gift?.pinned_time_seconds,
            source: 'kicks.gifted',
          },
        },
      });

      this.logger.log(`✅ [Kick Coins] Event saved successfully!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   Sender: ${senderUsername}`);
      this.logger.log(`   Kick Coins: ${amount}`);
      this.logger.log(`   Gift: ${giftName} (${tier})`);
      this.logger.log(`   Message: ${message || '(none)'}`);

    } catch (error) {
      this.logger.error('❌ [Kick Coins] Error processing kicks gifted event:', error);
      this.logger.error('❌ [Kick Coins] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Get Kick Coins donated by user in the specified window
   */
  private async getKickCoinsForUser(
    adminUserId: string,
    kickUserId: number,
    window: DonationWindow,
  ): Promise<number> {
    try {
      
      // Get leaderboard from Kick API
      const response = await this.kickService.getKickCoinsLeaderboard(adminUserId);

      if (!response || !response.data) {
        this.logger.warn('⚠️ [Kick] Invalid Kick Coins leaderboard response - missing data');
        return 0;
      }

      // Choose the correct time window
      let leaderboard: any[];
      switch (window) {
        case 'MONTHLY':
          leaderboard = response.data.month || [];
          break;
        case 'WEEKLY':
          leaderboard = response.data.week || [];
          break;
        case 'DAILY':
          // Kick doesn't have daily, use week as fallback
          leaderboard = response.data.week || [];
          break;
        default:
          leaderboard = response.data.month || [];
      }


      // Find user in leaderboard
      const userEntry = leaderboard.find((entry: any) => entry.user_id === kickUserId);

      if (!userEntry) {
        return 0;
      }

      // Get the donated amount (could be 'amount' or 'gifted_amount' depending on API)
      const amount = userEntry.gifted_amount || userEntry.amount || 0;

      this.logger.log(`📊 Found ${amount} Kick Coins from user ${kickUserId} in ${window} window`);
      return amount;
    } catch (error) {
      this.logger.error(`❌ Error fetching Kick Coins for user ${kickUserId}:`, error);
      return 0;
    }
  }

  /**
   * Get Gift Subs from user in the specified window
   */
  private async getGiftSubsForUser(
    adminUserId: string,
    kickUserId: number,
    username: string,
    window: DonationWindow,
  ): Promise<number> {
    try {
      // Get connected account to get channel name
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          userId: adminUserId,
          platform: ConnectedPlatform.KICK,
        },
      });

      if (!connectedAccount || !connectedAccount.displayName) {
        this.logger.warn('⚠️ [Kick] No connected Kick account found');
        return 0;
      }

      const channelName = connectedAccount.displayName; // Use displayName (slug) for API calls
      
      // Fetch gift subs leaderboard - using the same method as the controller
      const leaderboard = await this.kickService.getGiftSubsLeaderboard(
        adminUserId,
        channelName,
        {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'accept-language': 'en-US,en;q=0.9',
        },
      );

      // Check if response has time windows (data.month/week) or direct gifts array
      let giftsArray: any[];
      
      if (leaderboard?.data) {
        // New format with time windows: {data: {lifetime, month, week}}
        
        switch (window) {
          case 'MONTHLY':
            giftsArray = leaderboard.data.month || [];
            break;
          case 'WEEKLY':
            giftsArray = leaderboard.data.week || [];
            break;
          case 'DAILY':
            // Kick doesn't have daily, use week as fallback
            giftsArray = leaderboard.data.week || [];
            break;
          default:
            giftsArray = leaderboard.data.month || [];
        }
      } else if (leaderboard?.gifts_month || leaderboard?.gifts_week) {
        // Format with gifts_month and gifts_week at root level: {gifts_month: [...], gifts_week: [...], gifts: [...]}
        
        switch (window) {
          case 'MONTHLY':
            giftsArray = leaderboard.gifts_month || [];
            break;
          case 'WEEKLY':
            giftsArray = leaderboard.gifts_week || [];
            break;
          case 'DAILY':
            // Kick doesn't have daily, use week as fallback
            giftsArray = leaderboard.gifts_week || [];
            break;
          default:
            giftsArray = leaderboard.gifts_month || [];
        }
      } else if (leaderboard?.gifts) {
        // Old format: {gifts: [...]} - This is LIFETIME, should only be used as fallback
        giftsArray = leaderboard.gifts;
      } else {
        this.logger.warn('⚠️ [Kick] Invalid gift subs leaderboard response - unknown format');
        return 0;
      }

      // Find user in leaderboard (by username as Kick uses usernames in leaderboard)
      const userEntry = giftsArray.find(
        (entry: any) => entry.username?.toLowerCase() === username.toLowerCase(),
      );

      if (!userEntry) {
        return 0;
      }

      const giftCount = userEntry.gifted_amount || userEntry.quantity || 0;

      this.logger.log(`📊 Found ${giftCount} gifted subs from user ${username} (window: ${window})`);
      return giftCount;
    } catch (error) {
      this.logger.error(`❌ Error fetching gift subs for user ${username}:`, error);
      this.logger.error(`❌ [DEBUG] Error stack:`, error instanceof Error ? error.stack : String(error));
      return 0;
    }
  }

  /**
   * Calculate tickets for Kick Coins
   */
  private calculateKickCoinsTickets(
    kickCoins: number,
    ticketConfig: any,
  ): number {
    if (!ticketConfig) {
      // Default: 1 ticket per 100 Kick Coins
      return Math.floor(kickCoins / 100);
    }

    const baseTickets = ticketConfig.tickets || 0;
    const coinsPerTicket = ticketConfig.unitsPerTicket || 100;

    // Calculate extra tickets based on donation amount
    const extraTickets = Math.floor(kickCoins / coinsPerTicket);

    return baseTickets + extraTickets;
  }
}

