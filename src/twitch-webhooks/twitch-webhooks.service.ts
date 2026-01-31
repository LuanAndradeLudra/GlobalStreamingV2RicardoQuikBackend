import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StreamGiveawayRedisService } from '../stream-giveaway-redis/stream-giveaway-redis.service';
import { RealtimeGateway } from '../realtime-gateway/realtime-gateway.gateway';
import { GiveawayService } from '../giveaway/giveaway.service';
import { TwitchService } from '../twitch/twitch.service';
import { ConnectedPlatform, EntryMethod } from '@prisma/client';
import { DateRangeHelper } from '../utils/date-range.helper';
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
    const userId = event.chatter_user_id || 'unknown';
    
    try {
      const messageText = event.message?.text || '';
      const username = event.chatter_user_name;
      const broadcasterUserId = event.broadcaster_user_id;

      if (!messageText || !username || !userId || !broadcasterUserId) {
        return;
      }

      // 🏆 Verifica se há vencedor ativo e salva a mensagem no Redis
      // Busca por todos os sorteios ativos desta plataforma/canal
      const winnerConnectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.TWITCH,
          externalChannelId: broadcasterUserId,
        },
      });

      if (winnerConnectedAccount) {
        // Busca sorteios DONE (que tiveram vencedor sorteado) do usuário
        const doneGiveaways = await this.prisma.streamGiveaway.findMany({
          where: {
            userId: winnerConnectedAccount.userId,
            status: 'DONE' as any,
          },
        });

        // Para cada sorteio, verifica se há vencedor no Redis
        for (const giveaway of doneGiveaways) {
          const winner = await this.redisService.getWinner(giveaway.id);
          
          if (winner && 
              winner.platform === ConnectedPlatform.TWITCH && 
              winner.externalUserId === userId) {
            // Esta mensagem é do vencedor! Salvar no Redis
            await this.redisService.addWinnerMessage(giveaway.id, {
              text: messageText,
              timestamp: new Date().toISOString(),
            });
            
            this.logger.log(`💬 Winner message saved: ${username} in giveaway ${giveaway.id}`);
          }
        }
      }

      // ⚠️ IMPORTANTE: NÃO processar cheermotes aqui!
      // Cheermotes (ex: Cheer25) já são capturados pelo evento `channel.cheer`
      // Se processarmos aqui também, haverá duplicação
      
      // ✅ Detectar bits com Power-Up/animação
      // Power-Ups podem vir de várias formas:
      // 1. power_ups_gigantified_emote - Emote gigante (15 bits)
      // 2. power_ups_message_effect - Animação de mensagem (10 bits)
      const messageType = event.message_type;
      const animationId = event.channel_points_animation_id;
      
      // Se o message_type indica Power-Up, é uma doação de bits
      if (messageType && messageType.startsWith('power_ups')) {
        this.logger.log(`💎 [Twitch Chat] Detected Power-Up: ${messageType}, animation: ${animationId || 'none'}`);
        
        // 🔴 DESABILITADO: Salvamento de eventos no banco
        // Usando API da Twitch (leaderboard) para bits diários ao invés da tabela Event
        // Para reativar: descomente a linha abaixo
        // await this.saveBitsEventFromPowerUp(event, broadcasterUserId, userId, username, messageText, messageType, animationId);
      }

      // Mapeia broadcasterUserId (Twitch) → userId (nosso sistema)
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.TWITCH,
          externalChannelId: broadcasterUserId,
        },
      });

      if (!connectedAccount) {
        return;
      }

      const adminUserId = connectedAccount.userId;

      // Busca sorteio ativo por palavra-chave na mensagem usando channelId
      // channelId = broadcasterUserId (Twitch channel ID)
      const activeGiveaway = await this.redisService.findActiveGiveawayByKeyword(
        ConnectedPlatform.TWITCH,
        broadcasterUserId, // channelId
        messageText,
      );

      if (!activeGiveaway) {
        return;
      }

      // Incrementa métrica de mensagens processadas
      await this.redisService.incrementMetric(
        activeGiveaway.streamGiveawayId,
        'total_messages_processed',
      );

      // Busca informações do usuário (foto, etc)
      const userInfo = await this.twitchService.getUserById(adminUserId, userId);
      const avatarUrl = userInfo?.profile_image_url || undefined;

      // Verifica se o usuário é subscriber e qual tier
      let subscriptionData: any = null;
      try {
        subscriptionData = await this.twitchService.getUserSubscription(
          adminUserId,
          broadcasterUserId,
          userId,
        );
      } catch (error) {
        this.logger.error(`❌ [Twitch] Error checking subscription for userId ${userId}:`, error);
        // Continua como NON_SUB
      }

      let role = 'TWITCH_NON_SUB';
      let method: EntryMethod = EntryMethod.TWITCH_NON_SUB;

      if (subscriptionData?.data?.[0]) {
        const tier = subscriptionData.data[0].tier;
        
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
      }

      // Track entries added for this user
      const entriesAdded: string[] = [];

      // Verifica se o role está permitido neste sorteio
      if (!activeGiveaway.allowedRoles.includes(role)) {
        // Não retorna - ainda pode ter entradas de doações (bits/gift subs)
        // Mas não adiciona entrada por tier/role
      } else {
        // Verifica dedupe - usuário já participou COM ESTE MÉTODO?
        // Nota: Mesmo usuário pode ter múltiplas entradas (tier + bits + gift subs)
        const isDuplicateTier = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.TWITCH,
          userId,
          method, // Verifica se já entrou com este tier específico
        );

        // ✅ Adiciona entrada por TIER (se não duplicado)
        if (!isDuplicateTier) {
          // Calcula tickets baseado nas regras do sorteio (tier)
          const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
            streamGiveawayId: activeGiveaway.streamGiveawayId,
            platform: ConnectedPlatform.TWITCH,
            adminUserId: activeGiveaway.userId,
            role: role,
          });

          if (ticketInfo.totalTickets > 0) {
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

            entriesAdded.push(`${method} (${ticketInfo.totalTickets} tickets)`);
          }
        }
      }

      // ✅ Verifica e adiciona entrada por BITS (se configurado)
      const bitsConfig = activeGiveaway.donationConfigs.find(
        (config) => config.platform === ConnectedPlatform.TWITCH && config.unitType === 'BITS',
      );

      if (bitsConfig) {
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

          // Se o usuário doou bits, ele recebe 2 tickets fixos (independente do valor doado)
          if (bitsAmount > 0) {
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
                tickets: 2, // 2 tickets fixos para qualquer doação de bits
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

            entriesAdded.push(`BITS (2 tickets)`);
          }
        }
      }

      // ✅ Verifica e adiciona entrada por GIFT_SUB (se configurado)
      const giftSubConfig = activeGiveaway.donationConfigs.find(
        (config) => config.platform === ConnectedPlatform.TWITCH && config.unitType === 'GIFT_SUB',
      );

      if (giftSubConfig) {
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

          // Se o usuário doou gift subs, ele recebe 2 tickets fixos (independente da quantidade doada)
          if (giftSubAmount > 0) {
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
                tickets: 2, // 2 tickets fixos para qualquer doação de gift subs
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

            entriesAdded.push(`GIFT_SUB (2 tickets)`);
          }
        }
      }

      // Log consolidado: userId e entradas adicionadas
      if (entriesAdded.length > 0) {
        this.logger.log(`✅ [Twitch] userId ${userId} added entries: ${entriesAdded.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`❌ [Twitch] Error processing chat message for userId ${userId}:`, error);
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
      
      // Calcula started_at seguindo a mesma lógica do frontend
      // Para DAILY: current day + 1 at 00:00 UTC-3 (Twitch API returns data for the day BEFORE the started_at)
      let startedAt: string | undefined;
      
      if (donationWindow === 'DAILY') {
        const now = new Date();
        // Converte para horário do Brasil (America/Sao_Paulo = UTC-3)
        const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        brazilTime.setDate(brazilTime.getDate() + 1); // +1 day
        brazilTime.setHours(0, 0, 0, 0);
        startedAt = brazilTime.toISOString();
        
        this.logger.log(`📅 [Twitch Bits] DAILY window - calculated started_at: ${startedAt}`);
      } else if (donationWindow === 'WEEKLY') {
        // For WEEKLY: get the current Monday + 7 days (next Monday)
        const now = new Date();
        const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const dayOfWeek = brazilTime.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek); // Days until next Monday
        brazilTime.setDate(brazilTime.getDate() + daysUntilMonday);
        brazilTime.setHours(0, 0, 0, 0);
        startedAt = brazilTime.toISOString();
      } else if (donationWindow === 'MONTHLY') {
        // For MONTHLY: first day of current month + 1 month
        const now = new Date();
        const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const firstDayNextMonth = new Date(brazilTime.getFullYear(), brazilTime.getMonth() + 1, 1);
        firstDayNextMonth.setHours(0, 0, 0, 0);
        startedAt = firstDayNextMonth.toISOString();
      }
      
      // Busca leaderboard de bits com started_at calculado
      const leaderboard = await this.twitchService.getBitsLeaderboard(adminUserId, period, startedAt);
      
      // Encontra o usuário no leaderboard
      const userEntry = leaderboard?.data?.find((entry: any) => entry.user_id === userId);
      
      return userEntry?.score || 0;
    } catch (error) {
      this.logger.error(`❌ [Twitch] Error fetching bits for userId ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Busca quantidade de gift subs doados por um usuário em um período
   * 
   * Para DAILY: Busca do banco de dados (Event table)
   * Para WEEKLY/MONTHLY: Usa a API da Twitch (endpoint /subscriptions)
   */
  private async getGiftSubsForUser(
    adminUserId: string,
    broadcasterUserId: string,
    userId: string,
    donationWindow: string,
  ): Promise<number> {
    try {
      // Se for DAILY, busca do banco de dados (Event table)
      if (donationWindow === 'DAILY') {
        const { start, end } = DateRangeHelper.getDailyRange();
        
        this.logger.log(`📅 [Twitch Gift Subs] Fetching DAILY from database for userId ${userId}`);
        
        // Busca eventos de gift subs do usuário no período diário
        const results = await this.prisma.event.groupBy({
          by: ['externalUserId'],
          where: {
            userId: adminUserId,
            platform: ConnectedPlatform.TWITCH,
            eventType: 'GIFT_SUBSCRIPTION',
            externalUserId: userId,
            eventDate: {
              gte: start,
              lt: end,
            },
          },
          _sum: {
            amount: true,
          },
        });

        // Se encontrou resultados, retorna a soma dos amounts
        if (results.length > 0 && results[0]._sum.amount) {
          const giftSubCount = results[0]._sum.amount;
          this.logger.log(`📊 [Twitch Gift Subs] Found ${giftSubCount} gift subs from user ${userId} in DAILY window`);
          return giftSubCount;
        }

        this.logger.log(`📊 [Twitch Gift Subs] No gift subs found for user ${userId} in DAILY window`);
        return 0;
      }

      // Para WEEKLY/MONTHLY, usa a API da Twitch
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
      
      return giftSubCount;
    } catch (error) {
      this.logger.error(`❌ [Twitch] Error fetching gift subs for userId ${userId}:`, error);
      this.logger.error(`❌ [Twitch] Error details:`, error instanceof Error ? error.stack : String(error));
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
    this.logger.error('❌ [Twitch Webhook] Subscription revoked');
    // TODO: Handle revocation - cleanup subscriptions, notify user, etc.
  }

  /**
   * Process bits (cheer) event from EventSub
   * EventSub subscription type: channel.cheer
   */
  async processBitsEvent(event: any): Promise<void> {
    this.logger.log('💎 [Twitch Bits] Processing bits event...');
    this.logger.log(`📝 [Twitch Bits] Event: ${JSON.stringify(event, null, 2)}`);
    
    try {
      const broadcasterUserId = event.broadcaster_user_id;
      const userId = event.user_id;
      const username = event.user_login || event.user_name;
      const bits = event.bits;
      const message = event.message || '';
      const isAnonymous = event.is_anonymous || false;

      this.logger.log(`💎 [Twitch Bits] Parsed: broadcaster=${broadcasterUserId}, user=${userId}, username=${username}, bits=${bits}`);

      if (!broadcasterUserId || !bits) {
        this.logger.warn('⚠️ [Twitch Bits] Missing required fields (broadcaster or bits)');
        return;
      }

      // Se é anônimo, não processar (ou processar de forma diferente)
      if (isAnonymous) {
        this.logger.log('💎 [Twitch Bits] Anonymous donation, skipping user registration');
        return;
      }

      if (!userId || !username) {
        this.logger.warn('⚠️ [Twitch Bits] Missing user info for non-anonymous donation');
        return;
      }

      // Find connected account
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.TWITCH,
          externalChannelId: broadcasterUserId,
        },
      });

      if (!connectedAccount) {
        this.logger.warn(`⚠️ [Twitch Bits] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      this.logger.log(`✅ [Twitch Bits] Found connected account for user ${connectedAccount.userId}`);

      // 🔴 DESABILITADO: Salvamento de eventos no banco
      // Usando API da Twitch (leaderboard) para bits diários ao invés da tabela Event
      // Para reativar: descomente o bloco abaixo
      
      /*
      // Save event to database
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.TWITCH,
          eventType: 'BITS',
          externalUserId: userId,
          username: username,
          amount: bits,
          message: message,
          metadata: {
            broadcasterUserId,
            isAnonymous,
            source: 'channel.cheer', // Marca que veio do EventSub channel.cheer
          },
        },
      });

      this.logger.log(`✅ [Twitch Bits] Event saved successfully!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   User: ${username}`);
      this.logger.log(`   Bits: ${bits}`);
      this.logger.log(`   Message: ${message || '(none)'}`);
      */

      this.logger.log(`ℹ️ [Twitch Bits] Event processing completed (database save disabled)`);
      this.logger.log(`   User: ${username}`);
      this.logger.log(`   Bits: ${bits}`);
      this.logger.log(`   Message: ${message || '(none)'}`);

    } catch (error) {
      this.logger.error('❌ [Twitch Bits] Error processing bits event:', error);
      this.logger.error('❌ [Twitch Bits] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Process subscription event from EventSub
   * EventSub subscription type: channel.subscribe
   * Handles: New subs, renewals (resubs), and received gifts
   */
  async processSubscriptionEvent(event: any): Promise<void> {
    this.logger.log('🎊 [Twitch Sub] Processing subscription event...');
    this.logger.log(`📝 [Twitch Sub] Event: ${JSON.stringify(event, null, 2)}`);
    
    try {
      const broadcasterUserId = event.broadcaster_user_id;
      const userId = event.user_id;
      const username = event.user_login || event.user_name;
      const tier = event.tier; // "1000", "2000", "3000", or "Prime"
      const isGift = event.is_gift || false;

      this.logger.log(`🎊 [Twitch Sub] Parsed: broadcaster=${broadcasterUserId}, user=${userId}, username=${username}, tier=${tier}, isGift=${isGift}`);

      if (!broadcasterUserId || !userId || !username) {
        this.logger.warn('⚠️ [Twitch Sub] Missing required fields');
        return;
      }

      // Find connected account
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.TWITCH,
          externalChannelId: broadcasterUserId,
        },
      });

      if (!connectedAccount) {
        this.logger.warn(`⚠️ [Twitch Sub] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      this.logger.log(`✅ [Twitch Sub] Found connected account for user ${connectedAccount.userId}`);

      // TODOS os eventos de channel.subscribe são SUBSCRIPTION
      // Não importa se é gift ou não, a pessoa se tornou um subscriber
      // O campo isGift no metadata distingue se foi presente ou não
      const eventType = 'SUBSCRIPTION';

      // Save event to database
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.TWITCH,
          eventType: eventType,
          externalUserId: userId,
          username: username,
          amount: 0, // Subs não têm amount (bits), mas o campo é obrigatório
          message: null, // Subs não têm mensagem neste evento
          metadata: {
            broadcasterUserId,
            tier,
            isGift, // Marca se foi gift ou não
            role: isGift ? 'receiver' : undefined, // Se for gift, marca como recebedor
            source: 'channel.subscribe',
          },
        },
      });

      this.logger.log(`✅ [Twitch Sub] Event saved successfully!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   User: ${username}`);
      this.logger.log(`   Type: ${isGift ? 'Gift Sub (Received) - New Subscriber' : 'New Sub / Renewal'}`);
      this.logger.log(`   Tier: ${tier}`);

    } catch (error) {
      this.logger.error('❌ [Twitch Sub] Error processing subscription event:', error);
      this.logger.error('❌ [Twitch Sub] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Process gift subscription event from EventSub
   * EventSub subscription type: channel.subscription.gift
   * Handles: Who GAVE gift subs (not who received them)
   */
  async processGiftSubEvent(event: any): Promise<void> {
    this.logger.log('🎁 [Twitch Gift] Processing gift subscription event...');
    this.logger.log(`📝 [Twitch Gift] Event: ${JSON.stringify(event, null, 2)}`);
    
    try {
      const broadcasterUserId = event.broadcaster_user_id;
      const userId = event.user_id; // Quem DOOU os gift subs
      const username = event.user_login || event.user_name;
      const tier = event.tier; // "1000", "2000", "3000"
      const total = event.total; // Quantidade total de gift subs dados
      const isAnonymous = event.is_anonymous || false;

      this.logger.log(`🎁 [Twitch Gift] Parsed: broadcaster=${broadcasterUserId}, gifter=${userId}, username=${username}, tier=${tier}, total=${total}, isAnonymous=${isAnonymous}`);

      if (!broadcasterUserId || !total) {
        this.logger.warn('⚠️ [Twitch Gift] Missing required fields');
        return;
      }

      // Se é anônimo, não processar
      if (isAnonymous) {
        this.logger.log('🎁 [Twitch Gift] Anonymous gift, skipping user registration');
        return;
      }

      if (!userId || !username) {
        this.logger.warn('⚠️ [Twitch Gift] Missing user info for non-anonymous gift');
        return;
      }

      // Find connected account
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.TWITCH,
          externalChannelId: broadcasterUserId,
        },
      });

      if (!connectedAccount) {
        this.logger.warn(`⚠️ [Twitch Gift] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      this.logger.log(`✅ [Twitch Gift] Found connected account for user ${connectedAccount.userId}`);

      // Save event to database
      // O doador é registrado como GIFT_SUBSCRIPTION com amount = quantidade de gifts
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.TWITCH,
          eventType: 'GIFT_SUBSCRIPTION',
          externalUserId: userId,
          username: username,
          amount: total, // Quantidade de gift subs doados
          message: null,
          metadata: {
            broadcasterUserId,
            tier,
            total,
            isAnonymous,
            role: 'gifter', // Marca que este é o doador, não o recebedor
            source: 'channel.subscription.gift',
          },
        },
      });

      this.logger.log(`✅ [Twitch Gift] Event saved successfully!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   Gifter: ${username}`);
      this.logger.log(`   Total Gift Subs: ${total}`);
      this.logger.log(`   Tier: ${tier}`);

    } catch (error) {
      this.logger.error('❌ [Twitch Gift] Error processing gift subscription event:', error);
      this.logger.error('❌ [Twitch Gift] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Salva evento de bits detectado via Power-Up no chat.message
   * Bits enviados com Power-Up não geram evento channel.cheer, apenas chat.message
   * 
   * Tipos de Power-Up:
   * - power_ups_gigantified_emote: Emote gigante (350 bits)
   * - power_ups_message_effect: Efeito de mensagem (varia por animationId)
   */
  /**
   * Save bits event from cheermote (ex: Cheer25)
   */
  private async saveBitsEventFromCheermote(
    event: any,
    broadcasterUserId: string,
    userId: string,
    username: string,
    message: string,
    bits: number,
  ): Promise<void> {
    try {
      // Find connected account
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.TWITCH,
          externalChannelId: broadcasterUserId,
        },
      });

      if (!connectedAccount) {
        this.logger.warn(`⚠️ [Twitch Cheermote] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      // Extract cheermote info from message fragments
      const cheermoteFragment = event.message?.fragments?.find((f: any) => f.type === 'cheermote');
      const cheermotePrefix = cheermoteFragment?.cheermote?.prefix || 'cheer';
      const cheerTier = cheermoteFragment?.cheermote?.tier || 1;

      // Save event to database
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.TWITCH,
          eventType: 'BITS',
          externalUserId: userId,
          username: username,
          amount: bits,
          message: message,
          metadata: {
            broadcasterUserId,
            source: 'cheermote',
            cheermotePrefix,
            cheerTier,
            messageId: event.message_id,
            estimated: false, // Cheermotes têm valor exato
          },
        },
      });

      this.logger.log(`✅ [Twitch Cheermote] Event saved successfully!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   Sender: ${username}`);
      this.logger.log(`   Bits: ${bits} (${cheermotePrefix}${bits})`);
      this.logger.log(`   Message: ${message || '(none)'}`);

    } catch (error) {
      this.logger.error('❌ [Twitch Cheermote] Error saving bits event:', error);
      this.logger.error('❌ [Twitch Cheermote] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Save bits event from Power-Up (gigantified emote, message effect, etc.)
   */
  private async saveBitsEventFromPowerUp(
    event: any,
    broadcasterUserId: string,
    userId: string,
    username: string,
    message: string,
    messageType: string,
    animationId: string | null,
  ): Promise<void> {
    try {
      // Find connected account
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.TWITCH,
          externalChannelId: broadcasterUserId,
        },
      });

      if (!connectedAccount) {
        this.logger.warn(`⚠️ [Twitch Power-Up] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      // ✅ Deduplicação: Verificar se já existe evento com mesmo message_id
      const messageId = event.message_id;
      if (messageId) {
        const existingEvent = await this.prisma.event.findFirst({
          where: {
            userId: connectedAccount.userId,
            platform: ConnectedPlatform.TWITCH,
            eventType: 'BITS',
            metadata: {
              path: ['messageId'],
              equals: messageId,
            },
          },
        });

        if (existingEvent) {
          this.logger.warn(`⚠️ [Twitch Power-Up] Duplicate event detected (messageId: ${messageId}), skipping...`);
          return;
        }
      }

      // Determina quantidade de bits baseado no tipo de Power-Up
      let estimatedBits = 0;
      let powerUpType = 'unknown';

      // Mapeia message_type para quantidade de bits
      const messageTypeToBits: Record<string, number> = {
        'power_ups_gigantified_emote': 20,  // Emote gigante
        'power_ups_message_effect': 10,      // Efeito de mensagem
      };

      estimatedBits = messageTypeToBits[messageType] || 1; // Default: 1 bit para tipos desconhecidos
      
      if (messageType === 'power_ups_gigantified_emote') {
        powerUpType = 'Gigantified Emote';
      } else if (messageType === 'power_ups_message_effect') {
        powerUpType = animationId ? `Message Effect (${animationId})` : 'Message Effect';
      } else {
        powerUpType = `Unknown (${messageType})`;
        this.logger.warn(`⚠️ [Twitch Power-Up] Unknown Power-Up type: ${messageType}`);
      }

      // Save event to database
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.TWITCH,
          eventType: 'BITS',
          externalUserId: userId,
          username: username,
          amount: estimatedBits,
          message: message,
          metadata: {
            broadcasterUserId,
            messageType,
            animationId: animationId || null,
            messageId: messageId || null, // ✅ Armazenar messageId para deduplicação
            source: 'power_up',
            powerUpType,
            estimated: true,
          },
        },
      });

      this.logger.log(`✅ [Twitch Power-Up] Bits event saved!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   User: ${username}`);
      this.logger.log(`   Type: ${powerUpType}`);
      this.logger.log(`   Estimated Bits: ${estimatedBits}`);
      this.logger.log(`   Message: ${message || '(none)'}`);

    } catch (error) {
      this.logger.error('❌ [Twitch Power-Up] Error saving bits event:', error);
      this.logger.error('❌ [Twitch Power-Up] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }
}

