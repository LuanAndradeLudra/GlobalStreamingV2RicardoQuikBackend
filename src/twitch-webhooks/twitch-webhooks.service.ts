import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StreamGiveawayRedisService } from '../stream-giveaway-redis/stream-giveaway-redis.service';
import { RealtimeGateway } from '../realtime-gateway/realtime-gateway.gateway';
import { GiveawayService } from '../giveaway/giveaway.service';
import { TwitchService } from '../twitch/twitch.service';
import { ConnectedPlatform, EntryMethod } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TwitchWebhooksService {
  private readonly logger = new Logger(TwitchWebhooksService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: StreamGiveawayRedisService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly giveawayService: GiveawayService,
    private readonly twitchService: TwitchService,
  ) {
    this.webhookSecret = this.configService.get<string>('TWITCH_WEBHOOK_SECRET') || '';
    
    if (!this.webhookSecret) {
      this.logger.warn(
        '⚠️  Twitch webhook secret not configured. Set TWITCH_WEBHOOK_SECRET environment variable.',
      );
    }
  }

  /**
   * Verify webhook signature according to Twitch's documentation
   * 
   * According to https://dev.twitch.tv/docs/eventsub/handling-webhook-events/#verifying-the-event-message:
   * - Signature is HMAC-SHA256 hash of message_id + timestamp + rawBody
   * - The signature in header is prefixed with "sha256="
   * - The signature is hex encoded
   * 
   * IMPORTANT: The rawBody must be exactly as received, without any modifications
   */
  verifySignature(
    messageId: string,
    timestamp: string,
    rawBody: string | Buffer,
    signature: string,
  ): boolean {
    try {
      if (!this.webhookSecret) {
        this.logger.error('❌ [Twitch Webhook] Webhook secret not configured');
        return false;
      }

      // Convert rawBody to Buffer if it's a string
      const rawBodyBuffer = typeof rawBody === 'string' 
        ? Buffer.from(rawBody, 'utf8') 
        : rawBody;

      // Remove "sha256=" prefix if present
      const signatureWithoutPrefix = signature.replace(/^sha256=/, '');

      // Create HMAC-SHA256 hash: message_id + timestamp + rawBody
      const message = messageId + timestamp + rawBodyBuffer.toString('utf8');
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      hmac.update(message);
      const expectedSignature = hmac.digest('hex');

      // Convert signatures to buffers for comparison
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const receivedBuffer = Buffer.from(signatureWithoutPrefix, 'hex');

      // Buffers must be the same length for timingSafeEqual
      if (expectedBuffer.length !== receivedBuffer.length) {
        this.logger.error('❌ [Twitch Webhook] Signature length mismatch');
        return false;
      }

      // Compare signatures using constant-time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

      if (!isValid) {
        this.logger.error('❌ [Twitch Webhook] Signature verification failed');
        this.logger.error('❌ [Twitch Webhook] Message ID:', messageId);
        this.logger.error('❌ [Twitch Webhook] Timestamp:', timestamp);
        this.logger.error('❌ [Twitch Webhook] Raw body length:', rawBodyBuffer.length);
        this.logger.error('❌ [Twitch Webhook] Expected signature:', expectedSignature);
        this.logger.error('❌ [Twitch Webhook] Received signature:', signatureWithoutPrefix);
      }

      return isValid;
    } catch (error) {
      this.logger.error('❌ [Twitch Webhook] Signature verification error:', error);
      this.logger.error('❌ [Twitch Webhook] Error details:', error instanceof Error ? error.stack : String(error));
      return false;
    }
  }

  /**
   * Process chat message event from EventSub
   */
  async processChatMessage(event: any): Promise<void> {
    this.logger.log('📨 [Twitch Webhook] Chat message received');
    this.logger.log('📝 [Twitch Webhook] Message details:', JSON.stringify(event, null, 2));
    
    try {
      const messageText = event.message?.text || '';
      const username = event.chatter_user_name;
      const userId = event.chatter_user_id;
      const broadcasterUserId = event.broadcaster_user_id;

      if (!messageText || !username || !userId || !broadcasterUserId) {
        this.logger.warn('⚠️ Missing required fields in chat message event');
        return;
      }

      this.logger.log(`💬 [Twitch] Message: "${messageText}"`);
      this.logger.log(`👤 [Twitch] From: ${username} (ID: ${userId})`);
      this.logger.log(`📺 [Twitch] Broadcaster ID: ${broadcasterUserId}`);

      // Mapeia broadcasterUserId (Twitch) → userId (nosso sistema)
      const connectedAccount = await this.prisma.connectedAccount.findUnique({
        where: {
          platform_externalChannelId: {
            platform: ConnectedPlatform.TWITCH,
            externalChannelId: broadcasterUserId,
          },
        },
      });

      if (!connectedAccount) {
        this.logger.warn(`⚠️ No connected account found for Twitch broadcaster ID: ${broadcasterUserId}`);
        return;
      }

      const adminUserId = connectedAccount.userId;
      this.logger.log(`✅ Found admin userId: ${adminUserId} for broadcaster: ${broadcasterUserId}`);

      // Busca sorteio ativo por palavra-chave na mensagem
      const activeGiveaway = await this.redisService.findActiveGiveawayByKeyword(
        adminUserId,
        ConnectedPlatform.TWITCH,
        messageText,
      );

      if (!activeGiveaway) {
        this.logger.log('❌ No active giveaway found for this message');
        return;
      }

      this.logger.log(`✅ Active giveaway found: ${activeGiveaway.streamGiveawayId}`);

      // Incrementa métrica de mensagens processadas
      await this.redisService.incrementMetric(
        activeGiveaway.streamGiveawayId,
        'total_messages_processed',
      );

      // ✅ AGORA SIM: Busca foto e tier (só para mensagens com keyword válida)
      this.logger.log(`🔍 Fetching user info and subscription for ${username}...`);

      // Busca informações do usuário (foto, etc)
      const userInfo = await this.twitchService.getUserById(adminUserId, userId);
      const avatarUrl = userInfo?.profile_image_url || undefined;

      this.logger.log(`👤 User info: ${userInfo?.display_name}, avatar: ${avatarUrl ? 'found' : 'not found'}`);

      // Verifica se o usuário é subscriber e qual tier
      const subscriptionData = await this.twitchService.getUserSubscription(
        adminUserId,
        broadcasterUserId,
        userId,
      );

      let role = 'TWITCH_NON_SUB';
      let method: EntryMethod = EntryMethod.TWITCH_NON_SUB;

      if (subscriptionData?.data?.[0]) {
        const tier = subscriptionData.data[0].tier;
        this.logger.log(`✅ User is subscribed! Tier: ${tier}`);
        
        // Mapeia tier para role e method
        switch (tier) {
          case '1000':
            role = 'TWITCH_TIER_1';
            method = EntryMethod.TWITCH_TIER_1;
            break;
          case '2000':
            role = 'TWITCH_TIER_2';
            method = EntryMethod.TWITCH_TIER_2;
            break;
          case '3000':
            role = 'TWITCH_TIER_3';
            method = EntryMethod.TWITCH_TIER_3;
            break;
          default:
            role = 'TWITCH_TIER_1'; // Fallback para Tier 1
            method = EntryMethod.TWITCH_TIER_1;
        }
      } else {
        this.logger.log(`ℹ️ User is not subscribed (NON_SUB)`);
      }

      // Verifica dedupe - usuário já participou COM ESTE MÉTODO?
      // Nota: Mesmo usuário pode ter múltiplas entradas (tier + bits + gift subs)
      const isDuplicateTier = await this.redisService.checkDuplicate(
        activeGiveaway.streamGiveawayId,
        ConnectedPlatform.TWITCH,
        userId,
        method, // Verifica se já entrou com este tier específico
      );

      if (isDuplicateTier) {
        this.logger.log(`⚠️ User ${username} already participated with method ${method}`);
        // Não retorna - ainda pode ter entradas de doações (bits/gift subs)
      }

      // ✅ Adiciona entrada por TIER (se não duplicado)
      if (!isDuplicateTier) {
        // Calcula tickets baseado nas regras do sorteio (tier)
        const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
          streamGiveawayId: activeGiveaway.streamGiveawayId,
          platform: ConnectedPlatform.TWITCH,
          adminUserId: activeGiveaway.userId,
          role: role,
        });

        if (ticketInfo.totalTickets === 0) {
          this.logger.log(`⚠️ User ${username} has 0 tickets for role ${role} (role not allowed or no rules configured)`);
        } else {
          // Adiciona participante ao banco de dados (entrada por tier)
          const participantTier = await this.giveawayService.addParticipant(
            activeGiveaway.userId,
            activeGiveaway.streamGiveawayId,
            {
              platform: ConnectedPlatform.TWITCH,
              externalUserId: userId,
              username: username,
              avatarUrl: avatarUrl,
              method: method,
              tickets: ticketInfo.totalTickets,
              metadata: {
                messageText,
                role,
                tier: subscriptionData?.data?.[0]?.tier || null,
                baseTickets: ticketInfo.baseTickets,
              },
            },
          );

          // Marca no Redis para dedupe
          await this.redisService.markParticipant(
            activeGiveaway.streamGiveawayId,
            ConnectedPlatform.TWITCH,
            userId,
            method,
          );

          // Incrementa métrica de participantes
          await this.redisService.incrementMetric(
            activeGiveaway.streamGiveawayId,
            'total_participants',
          );

          // Broadcast em tempo real
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

          this.logger.log(`🎉 Participant added (tier): ${username} with ${ticketInfo.totalTickets} tickets (${role})`);
        }
      }

      // ✅ Verifica e adiciona entrada por BITS (se configurado)
      const bitsConfig = activeGiveaway.donationConfigs.find(
        (config) => config.platform === ConnectedPlatform.TWITCH && config.unitType === 'BITS',
      );

      if (bitsConfig) {
        this.logger.log(`🔍 Checking BITS donations for ${username}...`);

        // Verifica se já tem entrada de BITS
        const isDuplicateBits = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.TWITCH,
          userId,
          EntryMethod.BITS,
        );

        if (!isDuplicateBits) {
          // Busca quantidade de bits doados pelo usuário no período
          const bitsAmount = await this.getBitsForUser(
            activeGiveaway.userId,
            broadcasterUserId,
            userId,
            bitsConfig.donationWindow,
          );

          if (bitsAmount > 0) {
            this.logger.log(`✅ User donated ${bitsAmount} bits in ${bitsConfig.donationWindow} window`);

            // Calcula tickets baseado nas regras de doação
            const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
              streamGiveawayId: activeGiveaway.streamGiveawayId,
              platform: ConnectedPlatform.TWITCH,
              adminUserId: activeGiveaway.userId,
              role: role, // Usa o role base para buscar regras
              totalBits: bitsAmount,
            });

            if (ticketInfo.bitsTickets > 0) {
              // Adiciona participante ao banco de dados (entrada por BITS)
              const participantBits = await this.giveawayService.addParticipant(
                activeGiveaway.userId,
                activeGiveaway.streamGiveawayId,
                {
                  platform: ConnectedPlatform.TWITCH,
                  externalUserId: userId,
                  username: username,
                  avatarUrl: avatarUrl,
                  method: EntryMethod.BITS,
                  tickets: ticketInfo.bitsTickets,
                  metadata: {
                    bitsAmount,
                    donationWindow: bitsConfig.donationWindow,
                  },
                },
              );

              // Marca no Redis para dedupe
              await this.redisService.markParticipant(
                activeGiveaway.streamGiveawayId,
                ConnectedPlatform.TWITCH,
                userId,
                EntryMethod.BITS,
              );

              // Incrementa métrica
              await this.redisService.incrementMetric(
                activeGiveaway.streamGiveawayId,
                'total_participants',
              );

              // Broadcast
              this.realtimeGateway.emitParticipantAdded({
                streamGiveawayId: activeGiveaway.streamGiveawayId,
                participant: {
                  id: participantBits.id,
                  username: participantBits.username,
                  platform: participantBits.platform,
                  method: participantBits.method,
                  tickets: participantBits.tickets,
                  avatarUrl: participantBits.avatarUrl || undefined,
                },
              });

              this.logger.log(`🎉 Participant added (bits): ${username} with ${ticketInfo.bitsTickets} tickets (${bitsAmount} bits)`);
            }
          } else {
            this.logger.log(`ℹ️ User has no bits donations in ${bitsConfig.donationWindow} window`);
          }
        } else {
          this.logger.log(`⚠️ User ${username} already has BITS entry`);
        }
      }

      // ✅ Verifica e adiciona entrada por GIFT_SUB (se configurado)
      const giftSubConfig = activeGiveaway.donationConfigs.find(
        (config) => config.platform === ConnectedPlatform.TWITCH && config.unitType === 'GIFT_SUB',
      );

      if (giftSubConfig) {
        this.logger.log(`🔍 Checking GIFT_SUB donations for ${username}...`);

        // Verifica se já tem entrada de GIFT_SUB
        const isDuplicateGiftSub = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.TWITCH,
          userId,
          EntryMethod.GIFT_SUB,
        );

        if (!isDuplicateGiftSub) {
          // Busca quantidade de gift subs doados pelo usuário no período
          const giftSubAmount = await this.getGiftSubsForUser(
            activeGiveaway.userId,
            broadcasterUserId,
            userId,
            giftSubConfig.donationWindow,
          );

          if (giftSubAmount > 0) {
            this.logger.log(`✅ User gifted ${giftSubAmount} subs in ${giftSubConfig.donationWindow} window`);

            // Calcula tickets baseado nas regras de doação
            const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
              streamGiveawayId: activeGiveaway.streamGiveawayId,
              platform: ConnectedPlatform.TWITCH,
              adminUserId: activeGiveaway.userId,
              role: role,
              totalGiftSubs: giftSubAmount,
            });

            this.logger.log(`📊 Gift sub ticket calculation: baseTickets=${ticketInfo.baseTickets}, bitsTickets=${ticketInfo.bitsTickets}, giftTickets=${ticketInfo.giftTickets}, total=${ticketInfo.totalTickets}`);

            if (ticketInfo.giftTickets > 0) {
              // Adiciona participante ao banco de dados (entrada por GIFT_SUB)
              const participantGiftSub = await this.giveawayService.addParticipant(
                activeGiveaway.userId,
                activeGiveaway.streamGiveawayId,
                {
                  platform: ConnectedPlatform.TWITCH,
                  externalUserId: userId,
                  username: username,
                  avatarUrl: avatarUrl,
                  method: EntryMethod.GIFT_SUB,
                  tickets: ticketInfo.giftTickets,
                  metadata: {
                    giftSubAmount,
                    donationWindow: giftSubConfig.donationWindow,
                  },
                },
              );

              // Marca no Redis para dedupe
              await this.redisService.markParticipant(
                activeGiveaway.streamGiveawayId,
                ConnectedPlatform.TWITCH,
                userId,
                EntryMethod.GIFT_SUB,
              );

              // Incrementa métrica
              await this.redisService.incrementMetric(
                activeGiveaway.streamGiveawayId,
                'total_participants',
              );

              // Broadcast
              this.realtimeGateway.emitParticipantAdded({
                streamGiveawayId: activeGiveaway.streamGiveawayId,
                participant: {
                  id: participantGiftSub.id,
                  username: participantGiftSub.username,
                  platform: participantGiftSub.platform,
                  method: participantGiftSub.method,
                  tickets: participantGiftSub.tickets,
                  avatarUrl: participantGiftSub.avatarUrl || undefined,
                },
              });

              this.logger.log(`🎉 Participant added (gift subs): ${username} with ${ticketInfo.giftTickets} tickets (${giftSubAmount} subs)`);
            }
          } else {
            this.logger.log(`ℹ️ User has no gift sub donations in ${giftSubConfig.donationWindow} window`);
          }
        } else {
          this.logger.log(`⚠️ User ${username} already has GIFT_SUB entry`);
        }
      }
    } catch (error) {
      this.logger.error('❌ Error processing chat message:', error);
      this.logger.error('❌ Error stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Busca quantidade de bits doados por um usuário em um período
   */
  private async getBitsForUser(
    adminUserId: string,
    broadcasterUserId: string,
    userId: string,
    donationWindow: string,
  ): Promise<number> {
    try {
      // Calcula período baseado na donation window
      const period = this.mapDonationWindowToPeriod(donationWindow);
      
      // Busca leaderboard de bits
      const leaderboard = await this.twitchService.getBitsLeaderboard(adminUserId, period);
      
      // Encontra o usuário no leaderboard
      const userEntry = leaderboard?.data?.find((entry: any) => entry.user_id === userId);
      
      return userEntry?.score || 0;
    } catch (error) {
      this.logger.error(`Error fetching bits for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Busca quantidade de gift subs doados por um usuário em um período
   * Usa o endpoint /subscriptions com paginação e filtra por gifter_id
   * 
   * Nota: A API da Twitch não tem filtro de data, então retorna todas as gift subs ativas
   */
  private async getGiftSubsForUser(
    adminUserId: string,
    broadcasterUserId: string,
    userId: string,
    donationWindow: string,
  ): Promise<number> {
    try {
      // Busca todas as gift subs ativas deste gifter
      const giftSubCount = await this.twitchService.getGiftedSubsByGifter(
        adminUserId,
        broadcasterUserId,
        userId,
      );

      // Nota: A API retorna apenas subs ATIVAS (não canceladas)
      // Para filtrar por período, seria necessário:
      // 1. Armazenar eventos em tempo real via EventSub
      // 2. Ou fazer snapshot periódico e comparar deltas
      
      this.logger.log(`📊 Found ${giftSubCount} active gifted subs from user ${userId}`);
      
      return giftSubCount;
    } catch (error) {
      this.logger.error(`Error fetching gift subs for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Mapeia donation window para período da API da Twitch
   */
  private mapDonationWindowToPeriod(donationWindow: string): 'day' | 'week' | 'month' | 'all' {
    switch (donationWindow) {
      case 'DAILY':
        return 'day';
      case 'WEEKLY':
        return 'week';
      case 'MONTHLY':
        return 'month';
      default:
        return 'all';
    }
  }

  /**
   * Process revocation event
   * This happens when a subscription is revoked (e.g., bot banned, timed out, etc.)
   */
  async processRevocation(event: any): Promise<void> {
    this.logger.warn('⚠️ [Twitch Webhook] Subscription revoked');
    this.logger.log('📝 [Twitch Webhook] Revocation details:', JSON.stringify(event, null, 2));
    
    if (event.subscription) {
      this.logger.log(`🔴 [Twitch Webhook] Subscription ID: ${event.subscription.id}`);
      this.logger.log(`🔴 [Twitch Webhook] Subscription Type: ${event.subscription.type}`);
      this.logger.log(`🔴 [Twitch Webhook] Status: ${event.subscription.status}`);
    }

    // TODO: Handle revocation - cleanup subscriptions, notify user, etc.
  }
}

