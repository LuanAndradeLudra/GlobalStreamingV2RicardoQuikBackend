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

      // Verifica dedupe - usuário já participou?
      // Usa TWITCH_NON_SUB como padrão para check inicial (vamos verificar tier depois)
      const isDuplicate = await this.redisService.checkDuplicate(
        activeGiveaway.streamGiveawayId,
        ConnectedPlatform.TWITCH,
        userId,
        EntryMethod.TWITCH_NON_SUB,
      );

      if (isDuplicate) {
        this.logger.log(`⚠️ User ${username} already participated`);
        return;
      }

      // ✅ AGORA SIM: Busca foto e tier (só se necessário)
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

      // Calcula tickets baseado nas regras do sorteio
      const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
        streamGiveawayId: activeGiveaway.streamGiveawayId,
        platform: ConnectedPlatform.TWITCH,
        adminUserId: activeGiveaway.userId,
        role: role, // Usa o role correto (TWITCH_TIER_1, TWITCH_NON_SUB, etc)
      });

      if (ticketInfo.totalTickets === 0) {
        this.logger.log(`⚠️ User ${username} has 0 tickets (role not allowed or no rules configured)`);
        return;
      }

      // Adiciona participante ao banco de dados
      const participant = await this.giveawayService.addParticipant(
        activeGiveaway.userId,
        activeGiveaway.streamGiveawayId,
        {
          platform: ConnectedPlatform.TWITCH,
          externalUserId: userId,
          username: username,
          avatarUrl: avatarUrl,
          method: method, // Usa o method correto
          tickets: ticketInfo.totalTickets,
          metadata: {
            messageText,
            role,
            tier: subscriptionData?.data?.[0]?.tier || null,
            baseTickets: ticketInfo.baseTickets,
            bitsTickets: ticketInfo.bitsTickets,
            giftTickets: ticketInfo.giftTickets,
          },
        },
      );

      // Marca no Redis para dedupe
      await this.redisService.markParticipant(
        activeGiveaway.streamGiveawayId,
        ConnectedPlatform.TWITCH,
        userId,
        method, // Usa o method correto
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
          id: participant.id,
          username: participant.username,
          platform: participant.platform,
          method: participant.method,
          tickets: participant.tickets,
          avatarUrl: participant.avatarUrl || undefined,
        },
      });

      this.logger.log(`🎉 Participant added: ${username} with ${ticketInfo.totalTickets} tickets`);
    } catch (error) {
      this.logger.error('❌ Error processing chat message:', error);
      this.logger.error('❌ Error stack:', error instanceof Error ? error.stack : String(error));
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

