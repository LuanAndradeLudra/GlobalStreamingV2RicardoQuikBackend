import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { GiveawayService } from '../giveaway/giveaway.service';
import { ConnectedPlatform, StreamGiveawayStatus } from '@prisma/client';

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
    isSubscriber?: boolean;
    subscriberMonthDuration?: number;
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

@Injectable()
export class YouTubeChatService {
  private readonly logger = new Logger(YouTubeChatService.name);
  private readonly workers = new Map<string, ChatWorker>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly giveawayService: GiveawayService,
  ) {}

  /**
   * Get liveChatId for a channel's active live stream
   */
  async getLiveChatId(channelId: string, accessToken: string): Promise<string | null> {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // Get active broadcasts for the channel
      const broadcastsResponse = await youtube.liveBroadcasts.list({
        part: ['snippet'],
        broadcastStatus: 'active',
        broadcastType: 'all',
      });

      const broadcasts = broadcastsResponse.data.items || [];
      if (broadcasts.length === 0) {
        return null;
      }

      const live = broadcasts[0];
      const liveChatId = live.snippet?.liveChatId;

      if (!liveChatId) {
        return null;
      }

      return liveChatId;
    } catch (error) {
      this.logger.error(`❌ [YouTube] Error getting liveChatId for channel ${channelId}:`, error);
      throw error;
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
      return;
    }

    // Setup OAuth2 client (reuse Google OAuth credentials)
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
    const redirectUri = `${backendUrl.replace(/\/$/, '')}/api/connected-accounts/oauth/youtube/callback`;

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
      if (tokens.refresh_token) {
        // Update refresh token in database
        this.updateRefreshToken(channelId, tokens.refresh_token).catch((err) => {
          this.logger.error(`❌ [YouTube] Failed to update refresh token:`, err);
        });
      }
      if (tokens.access_token) {
        // Update access token in worker
        const worker = this.workers.get(channelId);
        if (worker) {
          oauth2Client.setCredentials({ access_token: tokens.access_token });
        }
      }
    });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Get liveChatId
    const liveChatId = await this.getLiveChatId(channelId, accessToken);

    // Create worker
    const worker: ChatWorker = {
      channelId,
      liveChatId,
      oauth2Client,
      youtubeClient: youtube,
      intervalId: null,
      lastPageToken: undefined,
      isRunning: false,
      pollingIntervalMs: 2000, // Start with 2 seconds, will be adjusted by API response
    };

    this.workers.set(channelId, worker);

    // Start polling
    this.startPolling(worker);
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
      try {
        // If no liveChatId, try to get it
        if (!worker.liveChatId) {
          const accessToken = (await worker.oauth2Client.getAccessToken()).token;
          worker.liveChatId = await this.getLiveChatId(worker.channelId, accessToken);
          if (!worker.liveChatId) {
            // Retry in 30 seconds if no live stream
            worker.intervalId = setTimeout(poll, 30000);
            return;
          }
        }

        // Poll for messages
        const accessToken = (await worker.oauth2Client.getAccessToken()).token;
        worker.oauth2Client.setCredentials({ access_token: accessToken });
        worker.youtubeClient = google.youtube({ version: 'v3', auth: worker.oauth2Client });

        const response = await worker.youtubeClient.liveChatMessages.list({
          liveChatId: worker.liveChatId,
          part: ['id', 'snippet', 'authorDetails'],
          pageToken: worker.lastPageToken,
          maxResults: 200,
        });

        const messages = (response.data.items || []) as LiveChatMessage[];
        const pollingIntervalMs = response.data.pollingIntervalMillis || 2000;
        worker.pollingIntervalMs = pollingIntervalMs;
        worker.lastPageToken = response.data.nextPageToken;

        // Process messages
        for (const message of messages) {
          await this.processChatMessage(worker.channelId, message);
        }

        // Schedule next poll
        worker.intervalId = setTimeout(poll, pollingIntervalMs);
      } catch (error: any) {
        this.logger.error(`❌ [YouTube] Error polling chat for channel ${worker.channelId}:`, error);

        // Handle rate limit
        if (error.code === 403 && error.message?.includes('quota')) {
          worker.intervalId = setTimeout(poll, 60000);
          return;
        }

        // Handle token refresh
        if (error.code === 401) {
          try {
            const { credentials } = await worker.oauth2Client.refreshAccessToken();
            worker.oauth2Client.setCredentials(credentials);
            worker.intervalId = setTimeout(poll, 5000);
            return;
          } catch (refreshError) {
            this.logger.error(`❌ [YouTube] Failed to refresh token for channel ${worker.channelId}:`, refreshError);
            this.stopChatPolling(worker.channelId);
            return;
          }
        }

        // Retry after error
        worker.intervalId = setTimeout(poll, 10000);
      }
    };

    // Start first poll immediately
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

    if (worker.intervalId) {
      clearTimeout(worker.intervalId);
      worker.intervalId = null;
    }

    worker.isRunning = false;
    this.workers.delete(channelId);
  }

  /**
   * Process a chat message and add to giveaways if applicable
   */
  private async processChatMessage(channelId: string, message: LiveChatMessage): Promise<void> {
    try {
      const displayMessage = message.snippet.displayMessage || message.snippet.textMessageDetails?.messageText || '';
      const authorName = message.authorDetails.displayName;
      const authorChannelId = message.authorDetails.channelId;
      const avatarUrl = message.authorDetails.profileImageUrl;
      const isSubscriber = message.authorDetails.isSubscriber || false;
      const subscriberMonthDuration = message.authorDetails.subscriberMonthDuration || 0;

      // Check if message contains giveaway keyword
      // Get all active giveaways for this channel
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          platform: ConnectedPlatform.YOUTUBE,
          externalChannelId: channelId,
        },
      });

      if (!connectedAccount) {
        return;
      }

      // Get all OPEN giveaways that include YouTube platform
      // Note: platforms is a JSON array, so we need to use Prisma's JSON filtering
      const allGiveaways = await this.prisma.streamGiveaway.findMany({
        where: {
          userId: connectedAccount.userId,
          status: StreamGiveawayStatus.OPEN,
        },
      });

      // Filter giveaways that include YouTube platform in the platforms JSON array
      const giveaways = allGiveaways.filter((giveaway) => {
        const platforms = giveaway.platforms as ConnectedPlatform[];
        return Array.isArray(platforms) && platforms.includes(ConnectedPlatform.YOUTUBE);
      });

      // Track entries added for this user
      const entriesAdded: string[] = [];

      for (const giveaway of giveaways) {
        const keyword = (giveaway.keyword || '').toLowerCase();
        const messageLower = displayMessage.toLowerCase();

        // Check if message contains the keyword
        if (messageLower.includes(keyword)) {
          // Determine entry method based on subscription status
          const entryMethod = isSubscriber ? 'YOUTUBE_SUB' : 'YOUTUBE_NON_SUB';
          const role = entryMethod;

          // Check if role is allowed in this giveaway
          const allowedRoles = giveaway.allowedRoles as string[] || [];
          if (!allowedRoles.includes(role)) {
            continue; // Skip this giveaway, check next one
          }

          // Get ticket count for this method
          const ticketCalculation = await this.giveawayService.calculateTicketsForParticipant({
            streamGiveawayId: giveaway.id,
            platform: ConnectedPlatform.YOUTUBE,
            adminUserId: connectedAccount.userId,
            role: entryMethod,
          });

          const tickets = ticketCalculation.totalTickets;

          if (tickets > 0) {
            // Add participant
            await this.giveawayService.addParticipant(connectedAccount.userId, giveaway.id, {
              platform: ConnectedPlatform.YOUTUBE,
              externalUserId: authorChannelId,
              username: authorName,
              avatarUrl,
              method: entryMethod,
              tickets,
              metadata: {
                subscriberMonthDuration,
                messageId: message.id,
                messageText: displayMessage,
              },
            });

            entriesAdded.push(`${entryMethod} (${tickets} tickets)`);
          }
        }
      }

      // Handle SuperChat (if present)
      if (message.snippet.superChatDetails) {
        const superChatAmountMicros = parseInt(message.snippet.superChatDetails.amountMicros || '0');
        const superChatAmount = superChatAmountMicros / 1000000; // Convert from micros to currency units

        // Process SuperChat for giveaways
        for (const giveaway of giveaways) {
          const keyword = (giveaway.keyword || '').toLowerCase();
          const messageLower = displayMessage.toLowerCase();

          if (messageLower.includes(keyword)) {
            // For SuperChat, we need to check donation rules
            // Note: SuperChat tickets calculation would need donation configs
            // For now, we'll use a simplified approach - you may need to add SUPERCHAT donation rules
            // Get ticket count - SuperChat is treated as a donation
            const ticketCalculation = await this.giveawayService.calculateTicketsForParticipant({
              streamGiveawayId: giveaway.id,
              platform: ConnectedPlatform.YOUTUBE,
              adminUserId: connectedAccount.userId,
              role: isSubscriber ? 'YOUTUBE_SUB' : 'YOUTUBE_NON_SUB',
            });

            // TODO: Add proper SuperChat donation rule calculation
            // For now, use base tickets (SuperChat donation rules need to be implemented)
            const tickets = ticketCalculation.totalTickets;

            if (tickets > 0) {
              await this.giveawayService.addParticipant(connectedAccount.userId, giveaway.id, {
                platform: ConnectedPlatform.YOUTUBE,
                externalUserId: authorChannelId,
                username: authorName,
                avatarUrl,
                method: 'SUPERCHAT',
                tickets,
                metadata: {
                  amount: superChatAmount,
                  currency: message.snippet.superChatDetails.currency,
                  messageId: message.id,
                  messageText: displayMessage,
                },
              });

              entriesAdded.push(`SUPERCHAT (${tickets} tickets)`);
            }
          }
        }
      }

      // Log consolidado: userId e entradas adicionadas
      if (entriesAdded.length > 0) {
        this.logger.log(`✅ [YouTube] userId ${authorChannelId} added entries: ${entriesAdded.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`❌ [YouTube] Error processing chat message for userId ${message.authorDetails.channelId}:`, error);
    }
  }

  /**
   * Update refresh token in database
   */
  private async updateRefreshToken(channelId: string, refreshToken: string): Promise<void> {
    try {
      await this.prisma.connectedAccount.updateMany({
        where: {
          platform: ConnectedPlatform.YOUTUBE,
          externalChannelId: channelId,
        },
        data: {
          refreshToken,
        },
      });
    } catch (error) {
      this.logger.error(`❌ [YouTube] Failed to update refresh token:`, error);
    }
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
    for (const channelId of this.workers.keys()) {
      this.stopChatPolling(channelId);
    }
  }
}


