import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Subscription } from 'rxjs';
import { ConnectedPlatform, EntryMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GiveawayService } from '../giveaway/giveaway.service';
import { StreamGiveawayRedisService } from '../stream-giveaway-redis/stream-giveaway-redis.service';
import { RealtimeGateway } from '../realtime-gateway/realtime-gateway.gateway';
import { RedisService } from '../redis/redis.service';
import { StreamChatBus } from '../stream-chat/stream-chat-bus.service';

interface TikTokChatUser {
  id?: string;
  idStr?: string;
  nickname?: string;
  displayId?: string;
  isSubscribe?: boolean;
  subscribeInfo?: {
    isSubscribe?: boolean;
    isSubscribedToAnchor?: boolean;
  };
  avatarThumb?: { urlList?: string[] };
}

interface TikTokChatMessage {
  content?: string;
  user?: TikTokChatUser;
  userIdentity?: { isSubscriberOfAnchor?: boolean };
}

interface LiveConnection {
  connect(): Promise<unknown>;
  disconnect(): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

interface TikTokWorker {
  uniqueId: string;
  stopped: boolean;
  connection: LiveConnection | null;
  wake?: () => void;
  loggedOffline: boolean;
}

const LOCK_TTL_SECONDS = 60;
const OFFLINE_RETRY_MS = 30_000;
const WINNER_GRACE_MS = 90_000;

/**
 * Reads TikTok LIVE chat from the webcast connection and enrolls viewers
 * whose message contains the active giveaway keyword.
 *
 * TikTok's official Open API does not expose live chat. This worker connects
 * to the public webcast of the linked @username while a giveaway is OPEN.
 */
@Injectable()
export class TikTokChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TikTokChatService.name);
  private readonly instanceId = randomUUID();
  private readonly workers = new Map<string, TikTokWorker>();
  private readonly stopTimers = new Map<string, NodeJS.Timeout>();
  private openedSub?: Subscription;
  private closedSub?: Subscription;

  constructor(
    private readonly prisma: PrismaService,
    private readonly giveawayService: GiveawayService,
    private readonly redisService: StreamGiveawayRedisService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly redis: RedisService,
    private readonly streamChatBus: StreamChatBus,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.openedSub = this.streamChatBus.onOpened((userId) => {
      this.syncUser(userId).catch((error) => {
        this.logger.error(`❌ [TikTok] Failed to sync chat for user ${userId}:`, error);
      });
    });
    this.closedSub = this.streamChatBus.onClosed((event) => {
      if (event.immediate) {
        this.stopUser(event.userId).catch((error) => {
          this.logger.error(`❌ [TikTok] Failed to stop chat for user ${event.userId}:`, error);
        });
        return;
      }
      this.holdForWinner(event.userId).catch((error) => {
        this.logger.error(`❌ [TikTok] Failed to hold chat for winner window of user ${event.userId}:`, error);
      });
    });

    this.resumeOpenGiveaways().catch((error) => {
      this.logger.error('❌ [TikTok] Failed to resume chat for open giveaways:', error);
    });
  }

  onModuleDestroy(): void {
    this.openedSub?.unsubscribe();
    this.closedSub?.unsubscribe();
    for (const userId of this.stopTimers.keys()) {
      this.cancelScheduledStop(userId);
    }
    for (const uniqueId of [...this.workers.keys()]) {
      this.stopChatPolling(uniqueId);
    }
  }

  async syncUser(userId: string): Promise<void> {
    this.cancelScheduledStop(userId);

    const openGiveaway = await this.prisma.streamGiveaway.findFirst({
      where: { userId, status: 'OPEN' },
    });
    const platforms = (openGiveaway?.platforms as ConnectedPlatform[]) || [];
    if (!openGiveaway || !platforms.includes(ConnectedPlatform.TIKTOK)) {
      await this.stopUser(userId);
      return;
    }

    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, platform: ConnectedPlatform.TIKTOK },
    });
    if (!account) {
      this.logger.warn(`⚠️ [TikTok] No TikTok account linked for user ${userId}`);
      return;
    }

    this.startChatPolling(account.externalChannelId);
  }

  async stopUser(userId: string): Promise<void> {
    this.cancelScheduledStop(userId);
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, platform: ConnectedPlatform.TIKTOK },
    });
    if (account) {
      this.stopChatPolling(account.externalChannelId);
    }
  }

  startChatPolling(uniqueId: string): void {
    const normalized = uniqueId.toLowerCase();
    if (this.workers.has(normalized)) {
      this.logger.warn(`⚠️ [TikTok] Chat already running for @${normalized}`);
      return;
    }

    const worker: TikTokWorker = {
      uniqueId: normalized,
      stopped: false,
      connection: null,
      loggedOffline: false,
    };
    this.workers.set(normalized, worker);
    this.logger.log(`🔄 [TikTok] Starting live chat for @${normalized}`);
    this.run(worker).catch((error) => {
      this.logger.error(`❌ [TikTok] Fatal error in chat loop for @${normalized}:`, error);
      this.stopChatPolling(normalized);
    });
  }

  stopChatPolling(uniqueId: string): void {
    const normalized = uniqueId.toLowerCase();
    const worker = this.workers.get(normalized);
    if (!worker) {
      return;
    }

    this.logger.log(`🛑 [TikTok] Stopping live chat for @${normalized}`);
    worker.stopped = true;
    worker.wake?.();
    const connection = worker.connection;
    worker.connection = null;
    this.workers.delete(normalized);
    if (connection) {
      connection.disconnect().catch((error) => {
        this.logger.warn(`⚠️ [TikTok] Disconnect failed for @${normalized}:`, error);
      });
    }
    this.releaseLock(normalized).catch(() => undefined);
  }

  isPollingActive(uniqueId: string): boolean {
    return this.workers.get(uniqueId.toLowerCase())?.stopped === false;
  }

  private async holdForWinner(userId: string): Promise<void> {
    const giveaway = await this.prisma.streamGiveaway.findFirst({
      where: { userId, status: 'DONE' },
      orderBy: { updatedAt: 'desc' },
    });
    const platforms = (giveaway?.platforms as ConnectedPlatform[]) || [];
    if (!platforms.includes(ConnectedPlatform.TIKTOK)) {
      return;
    }

    this.cancelScheduledStop(userId);
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, platform: ConnectedPlatform.TIKTOK },
    });
    if (account && !this.isPollingActive(account.externalChannelId)) {
      this.startChatPolling(account.externalChannelId);
    }
    this.scheduleStopUser(userId);
  }

  private scheduleStopUser(userId: string): void {
    this.cancelScheduledStop(userId);
    const timer = setTimeout(() => {
      this.stopTimers.delete(userId);
      this.stopUser(userId).catch((error) => {
        this.logger.error(`❌ [TikTok] Failed to stop chat after winner window for user ${userId}:`, error);
      });
    }, WINNER_GRACE_MS);
    this.stopTimers.set(userId, timer);
    this.logger.log(`⏳ [TikTok] Keeping chat for ${WINNER_GRACE_MS / 1000}s to capture the winner message`);
  }

  private cancelScheduledStop(userId: string): void {
    const timer = this.stopTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.stopTimers.delete(userId);
    }
  }

  private async resumeOpenGiveaways(): Promise<void> {
    const openGiveaways = await this.prisma.streamGiveaway.findMany({
      where: { status: 'OPEN' },
    });
    for (const giveaway of openGiveaways) {
      const platforms = giveaway.platforms as ConnectedPlatform[];
      if (platforms.includes(ConnectedPlatform.TIKTOK)) {
        await this.syncUser(giveaway.userId);
      }
    }
  }

  private async run(worker: TikTokWorker): Promise<void> {
    // Loaded at runtime so the compiler does not pull the connector's generated protobuf types.
    const loadConnector = new Function('return import("tiktok-live-connector")') as () => Promise<{
      TikTokLiveConnection: new (uniqueId: string, options: Record<string, unknown>) => LiveConnection;
      WebcastEvent: { CHAT: string; STREAM_END: string };
      ControlEvent: { DISCONNECTED: string };
    }>;
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await loadConnector();

    while (!worker.stopped) {
      const locked = await this.acquireLock(worker.uniqueId);
      if (!locked) {
        await this.sleep(worker, 20_000);
        continue;
      }

      const renew = setInterval(() => {
        this.acquireLock(worker.uniqueId).catch(() => undefined);
      }, 20_000);

      let connection: LiveConnection | null = null;
      try {
        const signApiKey = this.configService.get<string>('TIKTOK_EULER_API_KEY');
        connection = new TikTokLiveConnection(worker.uniqueId, {
          processInitialData: false,
          fetchRoomInfoOnConnect: true,
          enableExtendedGiftInfo: false,
          ...(signApiKey ? { signApiKey } : {}),
        }) as LiveConnection;
        worker.connection = connection;

        connection.on(WebcastEvent.CHAT, (message) => {
          this.processChatMessage(worker.uniqueId, message as TikTokChatMessage).catch((error) => {
            this.logger.error(`❌ [TikTok] Error processing chat message:`, error);
          });
        });
        connection.on(WebcastEvent.STREAM_END, () => {
          connection?.disconnect().catch(() => undefined);
        });

        const disconnected = new Promise<void>((resolve) => {
          connection?.on(ControlEvent.DISCONNECTED, () => resolve());
        });

        await connection.connect();
        worker.loggedOffline = false;
        this.logger.log(`✅ [TikTok] Connected to live chat for @${worker.uniqueId}`);
        await disconnected;
        this.logger.log(`🔌 [TikTok] Disconnected from @${worker.uniqueId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!worker.loggedOffline) {
          this.logger.warn(`⏳ [TikTok] @${worker.uniqueId} is not live yet (${message}). Retrying every 30s.`);
          worker.loggedOffline = true;
        } else {
          this.logger.debug(`⏳ [TikTok] Still waiting for @${worker.uniqueId} to go live: ${message}`);
        }
      } finally {
        clearInterval(renew);
        worker.connection = null;
        if (connection) {
          await connection.disconnect().catch(() => undefined);
        }
      }

      if (!worker.stopped) {
        await this.sleep(worker, OFFLINE_RETRY_MS);
      }
    }
  }

  private async processChatMessage(uniqueId: string, message: TikTokChatMessage): Promise<void> {
    const raw = message as TikTokChatMessage & {
      comment?: string;
      uniqueId?: string;
      nickname?: string;
      userId?: string;
      profilePictureUrl?: string;
    };
    const messageText = (raw.content || raw.comment || '').trim();
    const user = raw.user;
    const userId = user?.idStr || user?.id || raw.userId || '';
    const username = user?.displayId || user?.nickname || raw.uniqueId || raw.nickname || '';
    const avatarUrl = user?.avatarThumb?.urlList?.[0] || raw.profilePictureUrl;

    if (!messageText || !userId || !username) {
      this.logger.warn(
        `⚠️ [TikTok] Chat event missing fields: text=${Boolean(messageText)} userId=${userId || 'empty'} username=${username || 'empty'} keys=${Object.keys(raw || {}).join(',')}`,
      );
      return;
    }

    this.logger.log(`💬 [TikTok] ${username}: ${messageText}`);

    await this.giveawayService.recordWinnerChatMessage({
      platform: ConnectedPlatform.TIKTOK,
      channelId: uniqueId,
      externalUserId: userId,
      text: messageText,
    });

    const activeGiveaway = await this.redisService.findActiveGiveawayByKeyword(
      ConnectedPlatform.TIKTOK,
      uniqueId,
      messageText,
    );
    if (!activeGiveaway) {
      return;
    }

    await this.redisService.incrementMetric(activeGiveaway.streamGiveawayId, 'total_messages_processed');

    const isSubscriber =
      message.userIdentity?.isSubscriberOfAnchor === true ||
      user?.isSubscribe === true ||
      user?.subscribeInfo?.isSubscribedToAnchor === true ||
      user?.subscribeInfo?.isSubscribe === true;

    const role = isSubscriber ? 'TIKTOK_SUB' : 'TIKTOK_NON_SUB';
    const method = isSubscriber ? EntryMethod.TIKTOK_SUB : EntryMethod.TIKTOK_NON_SUB;

    if (!activeGiveaway.allowedRoles.includes(role)) {
      this.logger.debug(`⚠️ [TikTok] Role ${role} not allowed in giveaway ${activeGiveaway.streamGiveawayId}`);
      return;
    }

    const isDuplicate = await this.redisService.checkDuplicate(
      activeGiveaway.streamGiveawayId,
      ConnectedPlatform.TIKTOK,
      userId,
      method,
    );
    if (isDuplicate) {
      return;
    }

    const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
      streamGiveawayId: activeGiveaway.streamGiveawayId,
      platform: ConnectedPlatform.TIKTOK,
      adminUserId: activeGiveaway.userId,
      role,
      isStreamGiveaway: true,
    });
    if (ticketInfo.totalTickets === 0) {
      this.logger.log(`⚠️ [TikTok] User ${username} has 0 tickets for role ${role}`);
      return;
    }

    const participant = await this.giveawayService.addParticipant(
      activeGiveaway.userId,
      activeGiveaway.streamGiveawayId,
      {
        platform: ConnectedPlatform.TIKTOK,
        externalUserId: userId,
        username,
        avatarUrl,
        method,
        tickets: ticketInfo.totalTickets,
        metadata: {
          role,
          baseTickets: ticketInfo.baseTickets,
          messageText,
          isSubscriber,
        },
      },
    );

    await this.redisService.markParticipant(
      activeGiveaway.streamGiveawayId,
      ConnectedPlatform.TIKTOK,
      userId,
      method,
    );
    await this.redisService.incrementMetric(activeGiveaway.streamGiveawayId, 'total_participants');

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

    this.logger.log(`✅ [TikTok] Participant added: ${username} with ${ticketInfo.totalTickets} tickets (${method})`);
  }

  private async acquireLock(uniqueId: string): Promise<boolean> {
    const key = this.lockKey(uniqueId);
    const current = await this.redis.get(key);
    if (current === this.instanceId) {
      await this.redis.expire(key, LOCK_TTL_SECONDS);
      return true;
    }
    if (current) {
      return false;
    }
    return this.redis.setNx(key, this.instanceId, LOCK_TTL_SECONDS);
  }

  private async releaseLock(uniqueId: string): Promise<void> {
    const key = this.lockKey(uniqueId);
    const current = await this.redis.get(key);
    if (current === this.instanceId) {
      await this.redis.del(key);
    }
  }

  private lockKey(uniqueId: string): string {
    return `chat:poll:tiktok:${uniqueId}`;
  }

  private sleep(worker: TikTokWorker, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        worker.wake = undefined;
        resolve();
      }, ms);
      worker.wake = () => {
        clearTimeout(timer);
        worker.wake = undefined;
        resolve();
      };
    });
  }
}
