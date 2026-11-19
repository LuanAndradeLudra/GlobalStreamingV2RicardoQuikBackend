import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { Subscription } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { GiveawayService } from '../giveaway/giveaway.service';
import { StreamGiveawayRedisService } from '../stream-giveaway-redis/stream-giveaway-redis.service';
import { RealtimeGateway } from '../realtime-gateway/realtime-gateway.gateway';
import { RedisService } from '../redis/redis.service';
import { StreamChatBus } from '../stream-chat/stream-chat-bus.service';
import { ConnectedPlatform, EntryMethod } from '@prisma/client';

interface LiveChatMessage {
  id: string;
  snippet: {
    type: string;
    liveChatId: string;
    authorChannelId: string;
    publishedAt: string;
    hasDisplayContent: boolean;
    displayMessage: string;
    textMessageDetails?: {
      messageText: string;
    };
    superChatDetails?: {
      amountMicros: string;
      currency: string;
      userComment: string;
    };
    superStickerDetails?: {
      amountMicros: string;
      currency: string;
    };
    memberMilestoneChatDetails?: {
      memberLevelName: string;
      memberMonth: number;
    };
  };
  authorDetails: {
    channelId: string;
    channelUrl: string;
    displayName: string;
    profileImageUrl: string;
    isVerified: boolean;
    isChatOwner: boolean;
    isChatSponsor: boolean;
    isChatModerator: boolean;
    isSubscriber?: boolean; // May not always be present in the API response
    subscriberMonthDuration?: number; // May not always be present in the API response
  };
}

interface ChatWorker {
  channelId: string;
  liveChatId: string | null;
  oauth2Client: any;
  youtubeClient: any;
  intervalId: NodeJS.Timeout | null;
  lastPageToken: string | undefined;
  isRunning: boolean;
  pollingIntervalMs: number;
}

const POLL_LOCK_TTL_SECONDS = 120;
const OFFLINE_RETRY_MS = 60_000;
const WINNER_GRACE_MS = 90_000;

@Injectable()
export class YouTubeChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(YouTubeChatService.name);
  private readonly instanceId = randomUUID();
  private readonly workers = new Map<string, ChatWorker>();
  private readonly stopTimers = new Map<string, NodeJS.Timeout>();
  private openedSub?: Subscription;
  private closedSub?: Subscription;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly giveawayService: GiveawayService,
    private readonly redisService: StreamGiveawayRedisService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly redis: RedisService,
    private readonly streamChatBus: StreamChatBus,
  ) {}

  onModuleInit(): void {
    this.openedSub = this.streamChatBus.onOpened((userId) => {
      this.syncUser(userId).catch((error) => {
        this.logger.error(`❌ [YouTube] Failed to sync chat for user ${userId}:`, error);
      });
    });
    this.closedSub = this.streamChatBus.onClosed((event) => {
      if (event.immediate) {
        this.stopUser(event.userId).catch((error) => {
          this.logger.error(`❌ [YouTube] Failed to stop chat for user ${event.userId}:`, error);
        });
        return;
      }
      this.holdForWinner(event.userId).catch((error) => {
        this.logger.error(`❌ [YouTube] Failed to hold chat for winner window of user ${event.userId}:`, error);
      });
    });

    this.resumeOpenGiveaways().catch((error) => {
      this.logger.error('❌ [YouTube] Failed to resume chat for open giveaways:', error);
    });
  }

  onModuleDestroy(): void {
    this.openedSub?.unsubscribe();
    this.closedSub?.unsubscribe();
    for (const userId of this.stopTimers.keys()) {
      this.cancelScheduledStop(userId);
    }
    this.stopAllWorkers();
  }

  /**
   * Start polling when this admin has an OPEN giveaway that includes YouTube.
   * Stops polling when YouTube is no longer part of the open giveaway.
   */
  async syncUser(userId: string): Promise<void> {
    this.cancelScheduledStop(userId);

    const openGiveaway = await this.prisma.streamGiveaway.findFirst({
      where: { userId, status: 'OPEN' },
    });
    const platforms = (openGiveaway?.platforms as ConnectedPlatform[]) || [];
    if (!openGiveaway || !platforms.includes(ConnectedPlatform.YOUTUBE)) {
      await this.stopUser(userId);
      return;
    }

    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, platform: ConnectedPlatform.YOUTUBE },
    });
    if (!account?.refreshToken) {
      this.logger.warn(`⚠️ [YouTube] No YouTube account with refresh token for user ${userId}`);
      return;
    }

    await this.startChatPolling(account.externalChannelId, account.accessToken, account.refreshToken);
  }

  async stopUser(userId: string): Promise<void> {
    this.cancelScheduledStop(userId);
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, platform: ConnectedPlatform.YOUTUBE },
    });
    if (account) {
      this.stopChatPolling(account.externalChannelId);
    }
  }

  /**
   * Get liveChatId for a channel's active live stream
   */
  async getLiveChatId(oauth2Client: any, channelId: string): Promise<string | null> {
    try {
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // Get broadcasts for the authenticated user
      // Note: Cannot use 'mine' and 'broadcastStatus' together, so we filter manually
      // The channelId parameter in this method is the external channel ID from our DB
      const broadcastsResponse = await youtube.liveBroadcasts.list({
        part: ['snippet', 'status'],
        broadcastType: 'all',
        mine: true,
      });

      const allBroadcasts = broadcastsResponse.data.items || [];
      
      // Filter for active broadcasts manually
      const activeBroadcasts = allBroadcasts.filter((broadcast) => {
        return broadcast.status?.lifeCycleStatus === 'live';
      });

      if (activeBroadcasts.length === 0) {
        this.logger.log(`📺 [YouTube] No active live stream found for channel ${channelId}`);
        return null;
      }

      const live = activeBroadcasts[0];
      const liveChatId = live.snippet?.liveChatId;

      if (!liveChatId) {
        this.logger.warn(`⚠️ [YouTube] Active broadcast found but no liveChatId for channel ${channelId}`);
        return null;
      }

      this.logger.log(`✅ [YouTube] Found liveChatId ${liveChatId} for channel ${channelId}`);
      return liveChatId;
    } catch (error: any) {
      // Don't throw error, just log it and return null
      // This allows the polling to retry later
      this.logger.error(`❌ [YouTube] Error getting liveChatId for channel ${channelId}:`, error?.message || error);
      if (error?.response?.data) {
        this.logger.debug(`📋 [YouTube] API Error details:`, JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  /**
   * Start polling chat messages for a channel
   */
  async startChatPolling(
    channelId: string,
    accessToken: string,
    refreshToken: string | null,
  ): Promise<void> {
    if (this.workers.has(channelId)) {
      this.logger.warn(`⚠️ [YouTube] Chat polling already running for channel ${channelId}`);
      return;
    }

    this.logger.log(`🔄 [YouTube] Starting chat polling for channel ${channelId}`);

    // Setup OAuth2 client (reuse Google OAuth credentials)
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
    const redirectUri = `${backendUrl.replace(/\/$/, '')}/connected-accounts/oauth/youtube/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('YouTube OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    // Refresh token if needed
    oauth2Client.on('tokens', (tokens) => {
      this.persistTokens(channelId, tokens).catch((err) => {
        this.logger.error(`❌ [YouTube] Failed to persist refreshed tokens:`, err);
      });
      if (tokens.access_token) {
        const worker = this.workers.get(channelId);
        if (worker) {
          oauth2Client.setCredentials({ access_token: tokens.access_token });
        }
      }
    });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Get liveChatId (optional - will retry in polling loop if not found)
    let liveChatId: string | null = null;
    try {
      liveChatId = await this.getLiveChatId(oauth2Client, channelId);
      if (!liveChatId) {
        this.logger.warn(`⚠️ [YouTube] No active live stream for channel ${channelId}, worker will retry`);
      }
    } catch (error: any) {
      this.logger.warn(`⚠️ [YouTube] Could not get liveChatId initially for channel ${channelId}, will retry:`, error?.message || error);
      // Continue anyway - polling loop will retry
    }

    // Create worker
    const worker: ChatWorker = {
      channelId,
      liveChatId,
      oauth2Client,
      youtubeClient: youtube,
      intervalId: null,
      lastPageToken: undefined,
      isRunning: false,
      pollingIntervalMs: 10000,
    };

    this.workers.set(channelId, worker);

    // Start polling (don't await - it's an async loop)
    this.startPolling(worker).catch((error) => {
      this.logger.error(`❌ [YouTube] Fatal error in polling loop for channel ${channelId}:`, error);
      this.stopChatPolling(channelId);
    });
  }

  /**
   * Start polling loop for a worker
   */
  private async startPolling(worker: ChatWorker): Promise<void> {
    if (worker.isRunning) {
      return;
    }

    worker.isRunning = true;

    const poll = async () => {
      if (!worker.isRunning) {
        return;
      }

      try {
        const locked = await this.acquirePollLock(worker.channelId);
        if (!locked) {
          worker.intervalId = setTimeout(poll, 20_000);
          return;
        }

        if (!worker.liveChatId) {
          this.logger.log(`🔍 [YouTube] No liveChatId found, attempting to get it for channel ${worker.channelId}`);
          try {
            const tokenResponse = await worker.oauth2Client.getAccessToken();
            if (!tokenResponse.token) {
              throw new Error('Failed to get access token');
            }

            worker.liveChatId = await this.getLiveChatId(worker.oauth2Client, worker.channelId);
            if (!worker.liveChatId) {
              this.logger.warn(`⏳ [YouTube] No active live stream found, retrying in 60 seconds...`);
              worker.intervalId = setTimeout(poll, OFFLINE_RETRY_MS);
              return;
            }
            worker.lastPageToken = undefined;
            this.logger.log(`✅ [YouTube] Found liveChatId: ${worker.liveChatId}`);
          } catch (error: any) {
            this.logger.error(`❌ [YouTube] Error getting liveChatId:`, error);
            worker.intervalId = setTimeout(poll, OFFLINE_RETRY_MS);
            return;
          }
        }

        const tokenResponse = await worker.oauth2Client.getAccessToken();
        const accessToken = tokenResponse.token;
        if (!accessToken) {
          throw new Error('Failed to get access token for polling');
        }
        worker.oauth2Client.setCredentials({ access_token: accessToken });
        worker.youtubeClient = google.youtube({ version: 'v3', auth: worker.oauth2Client });

        const response = await worker.youtubeClient.liveChatMessages.list({
          liveChatId: worker.liveChatId,
          part: ['id', 'snippet', 'authorDetails'],
          pageToken: worker.lastPageToken,
          maxResults: 200,
        });

        const messages = (response.data.items || []) as LiveChatMessage[];
        const pollingIntervalMs = Math.max(Number(response.data.pollingIntervalMillis) || 10000, 5000);
        worker.pollingIntervalMs = pollingIntervalMs;
        worker.lastPageToken = response.data.nextPageToken;

        if (messages.length > 0) {
          this.logger.log(`📥 [YouTube] Received ${messages.length} messages for channel ${worker.channelId}`);
        }

        for (const message of messages) {
          await this.processChatMessage(worker.channelId, message);
        }

        worker.intervalId = setTimeout(poll, pollingIntervalMs);
      } catch (error: any) {
        this.logger.error(`❌ [YouTube] Error polling chat for channel ${worker.channelId}:`, error);

        if (this.isLiveChatGone(error)) {
          this.logger.warn(`⏳ [YouTube] Live chat ended for channel ${worker.channelId}, looking for the next stream`);
          worker.liveChatId = null;
          worker.lastPageToken = undefined;
          worker.intervalId = setTimeout(poll, OFFLINE_RETRY_MS);
          return;
        }

        const reason = error?.errors?.[0]?.reason || error?.response?.data?.error?.errors?.[0]?.reason;
        if (error.code === 403 && (reason === 'quotaExceeded' || error.message?.includes('quota'))) {
          this.logger.warn(`⚠️ [YouTube] Quota exceeded, backing off for 60 seconds`);
          worker.intervalId = setTimeout(poll, 60000);
          return;
        }

        if (error.code === 401) {
          this.logger.log(`🔄 [YouTube] Token expired, refreshing...`);
          try {
            const { credentials } = await worker.oauth2Client.refreshAccessToken();
            worker.oauth2Client.setCredentials(credentials);
            await this.persistTokens(worker.channelId, credentials);
            worker.intervalId = setTimeout(poll, 5000);
            return;
          } catch (refreshError) {
            this.logger.error(`❌ [YouTube] Failed to refresh token:`, refreshError);
            this.stopChatPolling(worker.channelId);
            return;
          }
        }

        worker.intervalId = setTimeout(poll, worker.pollingIntervalMs || 10000);
      }
    };

    // Start first poll immediately
    this.logger.log(`🚀 [YouTube] Starting polling loop for channel ${worker.channelId}`);
    poll();
  }

  /**
   * Stop polling chat messages for a channel
   */
  stopChatPolling(channelId: string): void {
    const worker = this.workers.get(channelId);
    if (!worker) {
      return;
    }

    this.logger.log(`🛑 [YouTube] Stopping chat polling for channel ${channelId}`);

    if (worker.intervalId) {
      clearTimeout(worker.intervalId);
      worker.intervalId = null;
    }

    worker.isRunning = false;
    this.workers.delete(channelId);
    this.releasePollLock(channelId).catch(() => undefined);
  }

  /**
   * Process a chat message and add to giveaways if applicable
   * Follows the same flow as Twitch and Kick webhooks
   */
  private async processChatMessage(channelId: string, message: LiveChatMessage): Promise<void> {
    try {
      // Log full payload for debugging
      const messageText = (message.snippet.displayMessage || message.snippet.textMessageDetails?.messageText || '').trim();
      const userId = message.authorDetails.channelId;
      const username = message.authorDetails.displayName;
      const avatarUrl = message.authorDetails.profileImageUrl;

      if (!messageText || !userId || !username) {
        this.logger.warn('⚠️ [YouTube] Missing required fields');
        return;
      }

      await this.giveawayService.recordWinnerChatMessage({
        platform: ConnectedPlatform.YOUTUBE,
        channelId,
        externalUserId: userId,
        text: messageText,
      });

      // 1️⃣ Find connected account to get admin userId
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.YOUTUBE,
          externalChannelId: channelId,
        },
      });

      if (!connectedAccount) {
        return;
      }

      const adminUserId = connectedAccount.userId;

      // 2️⃣ Search for active giveaway by keyword in Redis using channelId
      // channelId = YouTube channel ID (já temos no parâmetro)
      const activeGiveaway = await this.redisService.findActiveGiveawayByKeyword(
        ConnectedPlatform.YOUTUBE,
        channelId, // channelId
        messageText,
      );

      if (!activeGiveaway) {
        return;
      }

      // Increment metric for messages processed
      await this.redisService.incrementMetric(
        activeGiveaway.streamGiveawayId,
        'total_messages_processed',
      );

      // 3️⃣ Check subscription status
      // NOTE: YouTube API does not provide reliable subscription info in chat messages
      // The isSubscriber field is often not present in the payload, even for subscribers
      // We can only reliably detect:
      // - isChatOwner: channel owner (always subscribed to themselves)
      // - isChatSponsor: channel member (paid membership, different from subscription)
      // 
      // For now, we'll treat everyone as NON_SUB except channel owners
      // TODO: If needed, we could implement a separate API call to check subscriptions,
      // but that would require the viewer's OAuth token (not practical)
      const isChatOwner = message.authorDetails.isChatOwner || false;
      const isChatSponsor = message.authorDetails.isChatSponsor || false;
      const isSubscriberFromPayload = message.authorDetails.isSubscriber === true;
      const subscriberMonthDuration = message.authorDetails.subscriberMonthDuration || 0;
      
      // Membership (isChatSponsor) is the paid equivalent of a sub. The free
      // subscriber flag is often absent from live chat payloads. The channel
      // owner is treated as a subscriber so the streamer can test the keyword.
      const isSubscriber = isChatOwner || isChatSponsor || isSubscriberFromPayload;
      
      // Determine role and method - for now, treat all as NON_SUB except channel owners
      // This is because YouTube API doesn't reliably provide subscription info
      let role = 'YOUTUBE_NON_SUB';
      let method: EntryMethod = EntryMethod.YOUTUBE_NON_SUB;
      
      if (isSubscriber) {
        role = 'YOUTUBE_SUB';
        method = EntryMethod.YOUTUBE_SUB;
        if (isChatOwner) {
          this.logger.debug(`✅ [YouTube] User ${username} is the channel owner (treated as subscriber)`);
        } else if (isSubscriberFromPayload) {
          this.logger.debug(`✅ [YouTube] User ${username} is a subscriber (${subscriberMonthDuration} months)`);
        }
      } else {
        this.logger.debug(`ℹ️ [YouTube] User ${username} - treating as NON_SUB (subscription info not available in API)`);
      }
      
      // Log additional info for debugging
      if (isChatSponsor) {
        this.logger.debug(`✅ [YouTube] User ${username} is a channel member (treated as subscriber)`);
      }
      
      // Log what we received from the API for debugging
      this.logger.debug(`🔍 [YouTube] Subscription check - isSubscriber: ${isSubscriberFromPayload}, isChatOwner: ${isChatOwner}, isChatSponsor: ${isChatSponsor}, subscriberMonthDuration: ${subscriberMonthDuration}`);

      // 4️⃣ Check if role is allowed in this giveaway
      if (!activeGiveaway.allowedRoles.includes(role)) {
        this.logger.debug(`⚠️ [YouTube] Role ${role} not allowed in giveaway ${activeGiveaway.streamGiveawayId}`);
      } else {

      // 5️⃣ Deduplication check - verify if user already participated with this method
      const isDuplicate = await this.redisService.checkDuplicate(
        activeGiveaway.streamGiveawayId,
        ConnectedPlatform.YOUTUBE,
        userId,
        method,
      );

      if (isDuplicate) {
        this.logger.debug(`⚠️ [YouTube] User ${username} already participated with method ${method}`);
        return;
      }

      // 6️⃣ Calculate tickets using TicketGlobalRule (same as Twitch/Kick)
      const ticketInfo = await this.giveawayService.calculateTicketsForParticipant({
        streamGiveawayId: activeGiveaway.streamGiveawayId,
        platform: ConnectedPlatform.YOUTUBE,
        adminUserId: activeGiveaway.userId,
        role: role,
        isStreamGiveaway: true, // This is a stream giveaway, use *_STREAM rules if available
      });

      if (ticketInfo.totalTickets === 0) {
        this.logger.log(`⚠️ [YouTube] User ${username} has 0 tickets for role ${role} (role not allowed or no rules configured)`);
        return;
      }

      // 7️⃣ Add participant to database
      const participant = await this.giveawayService.addParticipant(
        activeGiveaway.userId,
        activeGiveaway.streamGiveawayId,
        {
          platform: ConnectedPlatform.YOUTUBE,
          externalUserId: userId,
          username: username,
          avatarUrl: avatarUrl,
          method: method,
          tickets: ticketInfo.totalTickets,
          metadata: {
            role,
            baseTickets: ticketInfo.baseTickets,
            messageId: message.id,
            messageText: messageText,
            subscriberMonthDuration: subscriberMonthDuration,
            isSubscriber: isSubscriber,
          },
        },
      );

      this.logger.log(`✅ [YouTube] Participant added: ${username} with ${ticketInfo.totalTickets} tickets (${method})`);

      // 8️⃣ Mark participant in Redis for deduplication
      await this.redisService.markParticipant(
        activeGiveaway.streamGiveawayId,
        ConnectedPlatform.YOUTUBE,
        userId,
        method,
      );

      // 9️⃣ Increment metrics
      await this.redisService.incrementMetric(
        activeGiveaway.streamGiveawayId,
        'total_participants',
      );

      // 🔟 Broadcast to frontend (real-time update)
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
      }
    } catch (error) {
      this.logger.error(`❌ [YouTube] Error processing chat message:`, error);
    }
  }

  private async persistTokens(
    channelId: string,
    tokens: { access_token?: string | null; refresh_token?: string | null },
  ): Promise<void> {
    const data: { accessToken?: string; refreshToken?: string } = {};
    if (tokens.access_token) {
      data.accessToken = tokens.access_token;
    }
    if (tokens.refresh_token) {
      data.refreshToken = tokens.refresh_token;
    }
    if (!data.accessToken && !data.refreshToken) {
      return;
    }

    await this.prisma.connectedAccount.updateMany({
      where: {
        platform: ConnectedPlatform.YOUTUBE,
        externalChannelId: channelId,
      },
      data,
    });
  }

  private async holdForWinner(userId: string): Promise<void> {
    const giveaway = await this.prisma.streamGiveaway.findFirst({
      where: { userId, status: 'DONE' },
      orderBy: { updatedAt: 'desc' },
    });
    const platforms = (giveaway?.platforms as ConnectedPlatform[]) || [];
    if (!platforms.includes(ConnectedPlatform.YOUTUBE)) {
      return;
    }

    this.cancelScheduledStop(userId);
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, platform: ConnectedPlatform.YOUTUBE },
    });
    if (account?.refreshToken && !this.isPollingActive(account.externalChannelId)) {
      await this.startChatPolling(account.externalChannelId, account.accessToken, account.refreshToken);
    }
    this.scheduleStopUser(userId);
  }

  private scheduleStopUser(userId: string): void {
    this.cancelScheduledStop(userId);
    const timer = setTimeout(() => {
      this.stopTimers.delete(userId);
      this.stopUser(userId).catch((error) => {
        this.logger.error(`❌ [YouTube] Failed to stop chat after winner window for user ${userId}:`, error);
      });
    }, WINNER_GRACE_MS);
    this.stopTimers.set(userId, timer);
    this.logger.log(`⏳ [YouTube] Keeping chat for ${WINNER_GRACE_MS / 1000}s to capture the winner message`);
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
      if (platforms.includes(ConnectedPlatform.YOUTUBE)) {
        await this.syncUser(giveaway.userId);
      }
    }
  }

  private isLiveChatGone(error: { errors?: Array<{ reason?: string }>; response?: { data?: { error?: { errors?: Array<{ reason?: string }> } } }; message?: string }): boolean {
    const reasons = [
      error?.errors?.[0]?.reason,
      error?.response?.data?.error?.errors?.[0]?.reason,
    ];
    return reasons.some((reason) => reason === 'liveChatEnded' || reason === 'liveChatNotFound' || reason === 'liveChatDisabled')
      || (error?.message || '').includes('liveChatEnded');
  }

  private async acquirePollLock(channelId: string): Promise<boolean> {
    const key = this.pollLockKey(channelId);
    const current = await this.redis.get(key);
    if (current === this.instanceId) {
      await this.redis.expire(key, POLL_LOCK_TTL_SECONDS);
      return true;
    }
    if (current) {
      return false;
    }
    return this.redis.setNx(key, this.instanceId, POLL_LOCK_TTL_SECONDS);
  }

  private async releasePollLock(channelId: string): Promise<void> {
    const key = this.pollLockKey(channelId);
    const current = await this.redis.get(key);
    if (current === this.instanceId) {
      await this.redis.del(key);
    }
  }

  private pollLockKey(channelId: string): string {
    return `chat:poll:youtube:${channelId}`;
  }

  /**
   * Check if polling is active for a channel
   */
  isPollingActive(channelId: string): boolean {
    const worker = this.workers.get(channelId);
    return worker?.isRunning || false;
  }

  /**
   * Stop all workers (useful for shutdown)
   */
  stopAllWorkers(): void {
    this.logger.log(`🛑 [YouTube] Stopping all chat polling workers`);
    for (const channelId of this.workers.keys()) {
      this.stopChatPolling(channelId);
    }
  }
}


