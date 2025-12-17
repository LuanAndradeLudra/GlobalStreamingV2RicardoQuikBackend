import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StreamGiveawayRedisService } from '../stream-giveaway-redis/stream-giveaway-redis.service';
import { RedisService } from '../redis/redis.service';
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
    private readonly redis: RedisService,
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
        this.logger.error('❌ [Signature] Timestamp:', timestamp);
        this.logger.error('❌ [Signature] Raw body length:', rawBodyBuffer.length);
        this.logger.error('❌ [Signature] Raw body preview:', rawBodyBuffer.toString('utf8').substring(0, 100));
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

      this.logger.log(`💬 [Kick] Message: "${message}"`);
      this.logger.log(`👤 [Kick] From: ${username} (ID: ${userId})`);
      this.logger.log(`📝 [Kick] Sender object:`, JSON.stringify(event.sender).substring(0, 200));

      if (!message || !userId) {
        this.logger.warn('⚠️ [Kick] Missing required fields');
        return;
      }

      // 1️⃣ Search for active giveaway by keyword in Redis
      // Since we don't know which admin user has the giveaway, we need to search
      // all active KICK giveaways and find one matching the keyword
      const redisPattern = `giveaway:active:*:KICK:*`;
      const keys = await this.redis.keys(redisPattern);

      let activeGiveaway: any = null;
      let adminUserId: string | null = null;

      // Check each key to find one with matching keyword
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const giveaway = JSON.parse(data);
          const keyword = giveaway.keyword?.toLowerCase();
          const messageLower = message.toLowerCase();

          // Check if message contains the keyword
          if (keyword && messageLower.includes(keyword)) {
            activeGiveaway = giveaway;
            adminUserId = giveaway.userId;
            this.logger.log(`✅ Found matching giveaway: ${giveaway.streamGiveawayId} for user: ${adminUserId}`);
            break;
          }
        }
      }

      if (!activeGiveaway || !adminUserId) {
        this.logger.log('ℹ️ [Kick] No active giveaway found for this message');
        return;
      }

      this.logger.log(`✅ Active giveaway found: ${activeGiveaway.streamGiveawayId}`);

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

      this.logger.log(`👤 User role: ${role}`);

      // 4️⃣ Check if role is allowed in this giveaway
      if (!activeGiveaway.allowedRoles.includes(role)) {
        this.logger.log(`⚠️ [Kick] User role ${role} not allowed in this giveaway`);
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
        this.logger.log(`⚠️ User ${username} already participated with method ${method}`);
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

      this.logger.log(`🔍 Donation configs check - KICK_COINS: ${kickCoinsConfig ? 'ENABLED' : 'DISABLED'}`);

      if (kickCoinsConfig) {
        // Check if already added for KICK_COINS
        const isKickCoinsDuplicate = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.KICK,
          userId,
          EntryMethod.KICK_COINS,
        );

        if (!isKickCoinsDuplicate) {
          this.logger.log(`🔍 [Kick] Fetching Kick Coins for userId: ${userId} (parsed: ${parseInt(userId)})`);
          
          const kickCoins = await this.getKickCoinsForUser(
            adminUserId,
            parseInt(userId),
            kickCoinsConfig.donationWindow as DonationWindow,
          );

          if (kickCoins > 0) {
            this.logger.log(`✅ User donated ${kickCoins} Kick Coins in ${kickCoinsConfig.donationWindow} window`);

            // Calculate tickets for KICK_COINS (ONLY donation, no base role tickets)
            const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
              streamGiveawayId: activeGiveaway.streamGiveawayId,
              platform: ConnectedPlatform.KICK,
              adminUserId: activeGiveaway.userId,
              role: 'NON_SUB', // Use NON_SUB to ensure baseTickets = 0
              totalKickCoins: kickCoins, // Use totalKickCoins param for Kick Coins
            });

            this.logger.log(`📊 [Kick] Kick Coins ticket calculation result:`, {
              kickCoins,
              baseTickets: ticketInfo.baseTickets,
              kickCoinsTickets: ticketInfo.kickCoinsTickets,
              totalTickets: ticketInfo.totalTickets,
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

      this.logger.log(`🔍 Donation configs check - GIFT_SUB: ${giftSubConfig ? 'ENABLED' : 'DISABLED'}`);
      
      if (giftSubConfig) {
        this.logger.log(`📋 [DEBUG] Gift Sub Config encontrada:`, {
          platform: giftSubConfig.platform,
          unitType: giftSubConfig.unitType,
          donationWindow: giftSubConfig.donationWindow,
          configCompleta: JSON.stringify(giftSubConfig),
        });
        this.logger.log(`📋 [DEBUG] Stream Giveaway ID: ${activeGiveaway.streamGiveawayId}`);
        this.logger.log(`📋 [DEBUG] Todas as donationConfigs do sorteio:`, JSON.stringify(activeGiveaway.donationConfigs, null, 2));
      }

      if (giftSubConfig) {
        const isGiftSubDuplicate = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.KICK,
          userId,
          EntryMethod.GIFT_SUB,
        );

        if (!isGiftSubDuplicate) {
          this.logger.log(`🔍 [DEBUG] Buscando gift subs com donationWindow: ${giftSubConfig.donationWindow}`);
          const giftSubs = await this.getGiftSubsForUser(
            adminUserId,
            parseInt(userId),
            username,
            giftSubConfig.donationWindow as DonationWindow,
          );

          if (giftSubs > 0) {
            this.logger.log(`✅ User gifted ${giftSubs} subs in ${giftSubConfig.donationWindow} window`);

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
   */
  async processKicksGifted(event: any): Promise<void> {
    this.logger.log('💰 [Kick Webhook] Kicks gifted event received');
    this.logger.log('📝 [Kick Webhook] Kicks details:', JSON.stringify(event, null, 2));
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
      this.logger.log(`📊 [Kick] Fetching Kick Coins leaderboard for user ${kickUserId}...`);
      
      // Get leaderboard from Kick API
      const response = await this.kickService.getKickCoinsLeaderboard(adminUserId);

      this.logger.log(`📊 [Kick] Kick Coins raw response:`, JSON.stringify(response).substring(0, 300));

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

      this.logger.log(`📊 [Kick] Using ${window} leaderboard with ${leaderboard.length} entries`);

      // Find user in leaderboard
      const userEntry = leaderboard.find((entry: any) => entry.user_id === kickUserId);

      if (!userEntry) {
        this.logger.log(`ℹ️ [Kick] User ${kickUserId} not found in Kick Coins ${window} leaderboard`);
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
      this.logger.log(`🔍 [DEBUG] getGiftSubsForUser chamado com parâmetros:`, {
        adminUserId,
        kickUserId,
        username,
        window,
        windowType: typeof window,
      });

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
      
      this.logger.log(`📺 [Kick] Fetching gift subs for channel: ${channelName}`);
      this.logger.log(`📝 [Kick] Account info - externalChannelId: ${connectedAccount.externalChannelId}, displayName: ${connectedAccount.displayName}`);

      // Fetch gift subs leaderboard - using the same method as the controller
      const leaderboard = await this.kickService.getGiftSubsLeaderboard(
        adminUserId,
        channelName,
        {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'accept-language': 'en-US,en;q=0.9',
        },
      );

      this.logger.log(`📊 [DEBUG] Gift subs raw response completo:`, JSON.stringify(leaderboard, null, 2));
      this.logger.log(`📊 [DEBUG] Estrutura da resposta:`, {
        hasData: !!leaderboard?.data,
        hasGifts: !!leaderboard?.gifts,
        hasGiftsMonth: !!leaderboard?.gifts_month,
        hasGiftsWeek: !!leaderboard?.gifts_week,
        dataKeys: leaderboard?.data ? Object.keys(leaderboard.data) : [],
        dataMonthLength: leaderboard?.data?.month?.length || 0,
        dataWeekLength: leaderboard?.data?.week?.length || 0,
        dataLifetimeLength: leaderboard?.data?.lifetime?.length || 0,
        giftsLength: leaderboard?.gifts?.length || 0,
        giftsMonthLength: leaderboard?.gifts_month?.length || 0,
        giftsWeekLength: leaderboard?.gifts_week?.length || 0,
      });

      // Check if response has time windows (data.month/week) or direct gifts array
      let giftsArray: any[];
      
      if (leaderboard?.data) {
        // New format with time windows: {data: {lifetime, month, week}}
        this.logger.log(`📊 [DEBUG] Usando formato novo com data. Window solicitado: ${window}`);
        
        switch (window) {
          case 'MONTHLY':
            giftsArray = leaderboard.data.month || [];
            this.logger.log(`📊 [DEBUG] Selecionado MONTHLY - Array tem ${giftsArray.length} entradas`);
            if (giftsArray.length > 0) {
              this.logger.log(`📊 [DEBUG] Primeiras 3 entradas do MONTHLY:`, JSON.stringify(giftsArray.slice(0, 3), null, 2));
            }
            break;
          case 'WEEKLY':
            giftsArray = leaderboard.data.week || [];
            this.logger.log(`📊 [DEBUG] Selecionado WEEKLY - Array tem ${giftsArray.length} entradas`);
            if (giftsArray.length > 0) {
              this.logger.log(`📊 [DEBUG] Primeiras 3 entradas do WEEKLY:`, JSON.stringify(giftsArray.slice(0, 3), null, 2));
            }
            break;
          case 'DAILY':
            // Kick doesn't have daily, use week as fallback
            giftsArray = leaderboard.data.week || [];
            this.logger.log(`📊 [DEBUG] Selecionado DAILY (fallback para WEEKLY) - Array tem ${giftsArray.length} entradas`);
            break;
          default:
            giftsArray = leaderboard.data.month || [];
            this.logger.log(`📊 [DEBUG] Window desconhecido (${window}), usando MONTHLY como padrão - Array tem ${giftsArray.length} entradas`);
        }
        this.logger.log(`📊 [Kick] Using ${window} gift subs window with ${giftsArray.length} entries`);
      } else if (leaderboard?.gifts_month || leaderboard?.gifts_week) {
        // Format with gifts_month and gifts_week at root level: {gifts_month: [...], gifts_week: [...], gifts: [...]}
        this.logger.log(`📊 [DEBUG] Usando formato com gifts_month/gifts_week no root. Window solicitado: ${window}`);
        
        switch (window) {
          case 'MONTHLY':
            giftsArray = leaderboard.gifts_month || [];
            this.logger.log(`📊 [DEBUG] Selecionado MONTHLY (gifts_month) - Array tem ${giftsArray.length} entradas`);
            if (giftsArray.length > 0) {
              this.logger.log(`📊 [DEBUG] Primeiras 3 entradas do MONTHLY:`, JSON.stringify(giftsArray.slice(0, 3), null, 2));
            }
            break;
          case 'WEEKLY':
            giftsArray = leaderboard.gifts_week || [];
            this.logger.log(`📊 [DEBUG] Selecionado WEEKLY (gifts_week) - Array tem ${giftsArray.length} entradas`);
            if (giftsArray.length > 0) {
              this.logger.log(`📊 [DEBUG] Primeiras 3 entradas do WEEKLY:`, JSON.stringify(giftsArray.slice(0, 3), null, 2));
            }
            break;
          case 'DAILY':
            // Kick doesn't have daily, use week as fallback
            giftsArray = leaderboard.gifts_week || [];
            this.logger.log(`📊 [DEBUG] Selecionado DAILY (fallback para WEEKLY/gifts_week) - Array tem ${giftsArray.length} entradas`);
            break;
          default:
            giftsArray = leaderboard.gifts_month || [];
            this.logger.log(`📊 [DEBUG] Window desconhecido (${window}), usando MONTHLY (gifts_month) como padrão - Array tem ${giftsArray.length} entradas`);
        }
        this.logger.log(`📊 [Kick] Using ${window} gift subs window with ${giftsArray.length} entries`);
      } else if (leaderboard?.gifts) {
        // Old format: {gifts: [...]} - This is LIFETIME, should only be used as fallback
        this.logger.warn(`⚠️ [DEBUG] Usando formato antigo (gifts direto - LIFETIME). Window solicitado foi ${window}, mas usando lifetime como fallback`);
        giftsArray = leaderboard.gifts;
        this.logger.log(`📊 [DEBUG] Array tem ${giftsArray.length} entradas (LIFETIME)`);
        this.logger.log(`📊 [Kick] Using direct gifts array (LIFETIME) with ${giftsArray.length} entries`);
      } else {
        this.logger.warn('⚠️ [Kick] Invalid gift subs leaderboard response - unknown format');
        this.logger.warn(`⚠️ [DEBUG] Leaderboard completo:`, JSON.stringify(leaderboard, null, 2));
        return 0;
      }

      // Find user in leaderboard (by username as Kick uses usernames in leaderboard)
      this.logger.log(`🔍 [DEBUG] Procurando usuário "${username}" no array com ${giftsArray.length} entradas`);
      const userEntry = giftsArray.find(
        (entry: any) => entry.username?.toLowerCase() === username.toLowerCase(),
      );

      if (!userEntry) {
        this.logger.log(`ℹ️ [Kick] User ${username} not found in Gift Subs ${window} leaderboard`);
        this.logger.log(`🔍 [DEBUG] Usuários disponíveis no array (primeiros 10):`, 
          giftsArray.slice(0, 10).map((e: any) => ({ username: e.username, gifted_amount: e.gifted_amount, quantity: e.quantity }))
        );
        return 0;
      }

      this.logger.log(`✅ [DEBUG] Usuário encontrado! Entry completa:`, JSON.stringify(userEntry, null, 2));
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

  /**
   * Calculate tickets for Gift Subs
   */
  private calculateGiftSubTickets(
    giftSubs: number,
    ticketConfig: any,
  ): number {
    if (!ticketConfig) {
      // Default: 10 tickets per gift sub
      return giftSubs * 10;
    }

    const baseTickets = ticketConfig.tickets || 0;
    const subsPerTicket = ticketConfig.unitsPerTicket || 1;

    // Calculate extra tickets based on gift subs
    const extraTickets = Math.floor(giftSubs / subsPerTicket) * (ticketConfig.tickets || 10);

    return baseTickets + extraTickets;
  }
}

