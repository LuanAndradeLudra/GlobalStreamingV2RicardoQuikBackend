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
    const userId = event.sender?.user_id?.toString() || 'unknown';
    
    try {
      const message = event.content?.trim() || '';
      const username = event.sender?.username;
      const avatarUrl = event.sender?.profile_picture;
      const broadcasterUserId = event.broadcaster?.user_id?.toString();

      if (!message || !username || !userId || !broadcasterUserId) {
        return;
      }

      // 🏆 Verifica se há vencedor ativo e salva a mensagem no Redis
      // Busca por todos os sorteios ativos desta plataforma/canal
      const winnerConnectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.KICK,
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
              winner.platform === ConnectedPlatform.KICK && 
              winner.externalUserId === userId) {
            // Esta mensagem é do vencedor! Salvar no Redis
            await this.redisService.addWinnerMessage(giveaway.id, {
              text: message,
              timestamp: new Date().toISOString(),
            });
            
            this.logger.log(`💬 Winner message saved: ${username} in giveaway ${giveaway.id}`);
          }
        }
      }

      // Mapeia broadcasterUserId (Kick) → userId (nosso sistema)
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.KICK,
          externalChannelId: broadcasterUserId,
        },
      });

      if (!connectedAccount) {
        return;
      }

      const adminUserId = connectedAccount.userId;

      // Busca sorteio ativo por palavra-chave na mensagem usando channelId
      // channelId = broadcasterUserId (Kick channel ID)
      const activeGiveaway = await this.redisService.findActiveGiveawayByKeyword(
        ConnectedPlatform.KICK,
        broadcasterUserId, // channelId
        message,
      );

      if (!activeGiveaway) {
        return;
      }

      // Incrementa métrica de mensagens processadas
      await this.redisService.incrementMetric(
        activeGiveaway.streamGiveawayId,
        'total_messages_processed',
      );

      let role = 'KICK_NON_SUB';
      let method: EntryMethod = EntryMethod.KICK_NON_SUB;

      // Check if user has subscriber badge
      const badges = event.sender?.identity?.badges || [];
      const isSubscriber = badges.some((badge: any) => badge.type === 'subscriber' || badge.type === 'founder');

      if (isSubscriber) {
        role = 'KICK_SUB';
        method = EntryMethod.KICK_SUB;
      }

      // Track entries added for this user
      const entriesAdded: string[] = [];

      // Verifica se o role está permitido neste sorteio
      if (!activeGiveaway.allowedRoles.includes(role)) {
        // Não retorna - ainda pode ter entradas de doações (kick coins/gift subs)
        // Mas não adiciona entrada por tier/role
      } else {
        // Verifica dedupe - usuário já participou COM ESTE MÉTODO?
        // Nota: Mesmo usuário pode ter múltiplas entradas (tier + kick coins + gift subs)
        const isDuplicateTier = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.KICK,
          userId,
          method, // Verifica se já entrou com este tier específico
        );

        // ✅ Adiciona entrada por TIER (se não duplicado)
        if (!isDuplicateTier) {
          // Calcula tickets baseado nas regras do sorteio (tier)
          const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
            streamGiveawayId: activeGiveaway.streamGiveawayId,
            platform: ConnectedPlatform.KICK,
            adminUserId: activeGiveaway.userId,
            role: role,
          });

          if (ticketInfo.totalTickets > 0) {
            // Adiciona participante ao banco de dados (entrada por tier)
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
                  messageText: message,
                  role,
                  baseTickets: ticketInfo.baseTickets,
                },
              },
            );

            // Marca no Redis para dedupe
            await this.redisService.markParticipant(
              activeGiveaway.streamGiveawayId,
              ConnectedPlatform.KICK,
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

      // ✅ Verifica e adiciona entrada por KICK_COINS (se configurado)
      const kickCoinsConfig = activeGiveaway.donationConfigs.find(
        (config: any) => config.platform === ConnectedPlatform.KICK && config.unitType === 'KICK_COINS',
      );

      if (kickCoinsConfig) {
        // Verifica se já tem entrada de KICK_COINS
        const isDuplicateKickCoins = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.KICK,
          userId,
          EntryMethod.KICK_COINS,
        );

        if (!isDuplicateKickCoins) {
          // Busca quantidade de kick coins doados pelo usuário no período
          const kickCoins = await this.getKickCoinsForUser(
            activeGiveaway.userId,
            parseInt(userId),
            kickCoinsConfig.donationWindow as DonationWindow,
          );

          if (kickCoins > 0) {
            // Calcula tickets baseado nas regras de doação (ONLY donation, no base role tickets)
            const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
              streamGiveawayId: activeGiveaway.streamGiveawayId,
              platform: ConnectedPlatform.KICK,
              adminUserId: activeGiveaway.userId,
              role: 'NON_SUB', // Use NON_SUB to ensure baseTickets = 0
              totalKickCoins: kickCoins,
            });

            if (ticketInfo.kickCoinsTickets > 0) {
              // Adiciona participante ao banco de dados (entrada por KICK_COINS)
              const participantKickCoins = await this.giveawayService.addParticipant(
                activeGiveaway.userId,
                activeGiveaway.streamGiveawayId,
                {
                  platform: ConnectedPlatform.KICK,
                  externalUserId: userId,
                  username: username,
                  avatarUrl: avatarUrl,
                  method: EntryMethod.KICK_COINS,
                  // tickets: ticketInfo.kickCoinsTickets,
                  tickets: 2,
                  metadata: {
                    kickCoins,
                    donationWindow: kickCoinsConfig.donationWindow,
                  },
                },
              );

              // Marca no Redis para dedupe
              await this.redisService.markParticipant(
                activeGiveaway.streamGiveawayId,
                ConnectedPlatform.KICK,
                userId,
                EntryMethod.KICK_COINS,
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
                  id: participantKickCoins.id,
                  username: participantKickCoins.username,
                  platform: participantKickCoins.platform,
                  method: participantKickCoins.method,
                  tickets: participantKickCoins.tickets,
                  avatarUrl: participantKickCoins.avatarUrl || undefined,
                },
              });

              entriesAdded.push(`KICK_COINS (${ticketInfo.kickCoinsTickets} tickets)`);
            }
          }
        }
      }

      // ✅ Verifica e adiciona entrada por GIFT_SUB (se configurado)
      const giftSubConfig = activeGiveaway.donationConfigs.find(
        (config: any) => config.platform === ConnectedPlatform.KICK && config.unitType === 'GIFT_SUB',
      );

      if (giftSubConfig) {
        // Verifica se já tem entrada de GIFT_SUB
        const isDuplicateGiftSub = await this.redisService.checkDuplicate(
          activeGiveaway.streamGiveawayId,
          ConnectedPlatform.KICK,
          userId,
          EntryMethod.GIFT_SUB,
        );

        if (!isDuplicateGiftSub) {
          // Busca quantidade de gift subs doados pelo usuário no período
          const giftSubs = await this.getGiftSubsForUser(
            activeGiveaway.userId,
            parseInt(userId),
            username,
            giftSubConfig.donationWindow as DonationWindow,
          );

          if (giftSubs > 0) {
            // Calcula tickets baseado nas regras de doação (ONLY donation, no base role tickets)
            const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
              streamGiveawayId: activeGiveaway.streamGiveawayId,
              platform: ConnectedPlatform.KICK,
              adminUserId: activeGiveaway.userId,
              role: 'NON_SUB', // Use NON_SUB to ensure baseTickets = 0
              totalGiftSubs: giftSubs,
            });

            if (ticketInfo.giftTickets > 0) {
              // Adiciona participante ao banco de dados (entrada por GIFT_SUB)
              const participantGiftSub = await this.giveawayService.addParticipant(
                activeGiveaway.userId,
                activeGiveaway.streamGiveawayId,
                {
                  platform: ConnectedPlatform.KICK,
                  externalUserId: userId,
                  username: username,
                  avatarUrl: avatarUrl,
                  method: EntryMethod.GIFT_SUB,
                  // tickets: ticketInfo.giftTickets,
                  tickets: 2,
                  metadata: {
                    giftSubAmount: giftSubs,
                    donationWindow: giftSubConfig.donationWindow,
                  },
                },
              );

              // Marca no Redis para dedupe
              await this.redisService.markParticipant(
                activeGiveaway.streamGiveawayId,
                ConnectedPlatform.KICK,
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

              entriesAdded.push(`GIFT_SUB (${ticketInfo.giftTickets} tickets)`);
            }
          }
        }
      }

      // Log consolidado: userId e entradas adicionadas
      if (entriesAdded.length > 0) {
        this.logger.log(`✅ [Kick] userId ${userId} added entries: ${entriesAdded.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`❌ [Kick] Error processing chat message for userId ${userId}:`, error);
    }
  }

  /**
   * Process new subscription event
   * Webhook event type: channel.subscription.new
   */
  async processSubscriptionNew(event: any): Promise<void> {
    this.logger.log('🎊 [Kick Sub] Processing new subscription event...');
    this.logger.log(`📝 [Kick Sub] Event: ${JSON.stringify(event, null, 2)}`);

    try {
      const broadcasterUserId = event.broadcaster?.user_id?.toString();
      const broadcasterUsername = event.broadcaster?.username;
      const subscriberUserId = event.subscriber?.user_id?.toString();
      const subscriberUsername = event.subscriber?.username;
      const duration = event.duration; // Duração em meses
      const createdAt = event.created_at;
      const expiresAt = event.expires_at;

      this.logger.log(`🎊 [Kick Sub] Parsed: broadcaster=${broadcasterUserId}, subscriber=${subscriberUserId}, username=${subscriberUsername}, duration=${duration}`);

      if (!broadcasterUserId || !subscriberUserId || !subscriberUsername) {
        this.logger.warn('⚠️ [Kick Sub] Missing required fields');
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
        this.logger.warn(`⚠️ [Kick Sub] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      this.logger.log(`✅ [Kick Sub] Found connected account for user ${connectedAccount.userId}`);

      // Save event to database
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.KICK,
          eventType: 'SUBSCRIPTION',
          externalUserId: subscriberUserId,
          username: subscriberUsername,
          amount: 0, // Subs não têm amount
          message: null,
          metadata: {
            broadcasterUserId,
            broadcasterUsername,
            duration,
            createdAt,
            expiresAt,
            source: 'channel.subscription.new',
            type: 'new',
          },
        },
      });

      this.logger.log(`✅ [Kick Sub] Event saved successfully!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   Subscriber: ${subscriberUsername}`);
      this.logger.log(`   Duration: ${duration} month(s)`);
      this.logger.log(`   Expires: ${expiresAt}`);

    } catch (error) {
      this.logger.error('❌ [Kick Sub] Error processing new subscription event:', error);
      this.logger.error('❌ [Kick Sub] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Process subscription renewal event
   * Webhook event type: channel.subscription.renewal
   */
  async processSubscriptionRenewal(event: any): Promise<void> {
    this.logger.log('🔄 [Kick Renewal] Processing subscription renewal event...');
    this.logger.log(`📝 [Kick Renewal] Event: ${JSON.stringify(event, null, 2)}`);

    try {
      const broadcasterUserId = event.broadcaster?.user_id?.toString();
      const broadcasterUsername = event.broadcaster?.username;
      const subscriberUserId = event.subscriber?.user_id?.toString();
      const subscriberUsername = event.subscriber?.username;
      const duration = event.duration; // Duração em meses
      const createdAt = event.created_at;
      const expiresAt = event.expires_at;

      this.logger.log(`🔄 [Kick Renewal] Parsed: broadcaster=${broadcasterUserId}, subscriber=${subscriberUserId}, username=${subscriberUsername}, duration=${duration}`);

      if (!broadcasterUserId || !subscriberUserId || !subscriberUsername) {
        this.logger.warn('⚠️ [Kick Renewal] Missing required fields');
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
        this.logger.warn(`⚠️ [Kick Renewal] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      this.logger.log(`✅ [Kick Renewal] Found connected account for user ${connectedAccount.userId}`);

      // Save event to database
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.KICK,
          eventType: 'SUBSCRIPTION',
          externalUserId: subscriberUserId,
          username: subscriberUsername,
          amount: 0, // Subs não têm amount
          message: null,
          metadata: {
            broadcasterUserId,
            broadcasterUsername,
            duration,
            createdAt,
            expiresAt,
            source: 'channel.subscription.renewal',
            type: 'renewal',
          },
        },
      });

      this.logger.log(`✅ [Kick Renewal] Event saved successfully!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   Subscriber: ${subscriberUsername}`);
      this.logger.log(`   Duration: ${duration} month(s)`);
      this.logger.log(`   Expires: ${expiresAt}`);

    } catch (error) {
      this.logger.error('❌ [Kick Renewal] Error processing renewal event:', error);
      this.logger.error('❌ [Kick Renewal] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Process subscription gifts event
   * Webhook event type: channel.subscription.gifts
   */
  async processSubscriptionGifts(event: any): Promise<void> {
    this.logger.log('🎁 [Kick Gift] Processing subscription gifts event...');
    this.logger.log(`📝 [Kick Gift] Event: ${JSON.stringify(event, null, 2)}`);

    try {
      const broadcasterUserId = event.broadcaster?.user_id?.toString();
      const broadcasterUsername = event.broadcaster?.username;
      const gifterUserId = event.gifter?.user_id?.toString();
      const gifterUsername = event.gifter?.username;
      const isAnonymous = event.gifter?.is_anonymous || false;
      const giftees = event.giftees || [];
      const createdAt = event.created_at;
      const expiresAt = event.expires_at;

      this.logger.log(`🎁 [Kick Gift] Parsed: broadcaster=${broadcasterUserId}, gifter=${gifterUserId}, username=${gifterUsername}, giftees=${giftees.length}, isAnonymous=${isAnonymous}`);

      if (!broadcasterUserId || giftees.length === 0) {
        this.logger.warn('⚠️ [Kick Gift] Missing required fields');
        return;
      }

      // Se é anônimo, não processar
      if (isAnonymous) {
        this.logger.log('🎁 [Kick Gift] Anonymous gift, skipping user registration');
        return;
      }

      if (!gifterUserId || !gifterUsername) {
        this.logger.warn('⚠️ [Kick Gift] Missing gifter info for non-anonymous gift');
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
        this.logger.warn(`⚠️ [Kick Gift] No connected account found for broadcaster ${broadcasterUserId}`);
        return;
      }

      this.logger.log(`✅ [Kick Gift] Found connected account for user ${connectedAccount.userId}`);

      // Save event to database - O doador é registrado com amount = quantidade de gifts
      const savedEvent = await this.prisma.event.create({
        data: {
          userId: connectedAccount.userId,
          platform: ConnectedPlatform.KICK,
          eventType: 'GIFT_SUBSCRIPTION',
          externalUserId: gifterUserId,
          username: gifterUsername,
          amount: giftees.length, // Quantidade de gift subs doados
          message: null,
          metadata: {
            broadcasterUserId,
            broadcasterUsername,
            isAnonymous,
            createdAt,
            expiresAt,
            giftees: giftees.map((g: any) => ({
              userId: g.user_id,
              username: g.username,
            })),
            source: 'channel.subscription.gifts',
            role: 'gifter',
          },
        },
      });

      this.logger.log(`✅ [Kick Gift] Event saved successfully!`);
      this.logger.log(`   ID: ${savedEvent.id}`);
      this.logger.log(`   Gifter: ${gifterUsername}`);
      this.logger.log(`   Total Gift Subs: ${giftees.length}`);
      this.logger.log(`   Expires: ${expiresAt}`);

    } catch (error) {
      this.logger.error('❌ [Kick Gift] Error processing gift subscription event:', error);
      this.logger.error('❌ [Kick Gift] Stack:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Process subscription event (DEPRECATED - use specific methods above)
   * Kept for backwards compatibility
   */
  async processSubscription(event: any): Promise<void> {
    this.logger.log('🎁 [Kick Webhook] Subscription event received (deprecated method)');
    this.logger.log('📝 [Kick Webhook] Subscription details:', JSON.stringify(event, null, 2));
    // This method is deprecated, use processSubscriptionNew instead
    await this.processSubscriptionNew(event);
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

