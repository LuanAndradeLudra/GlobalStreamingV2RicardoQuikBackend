import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConnectedAccountsService } from '../connected-accounts/connected-accounts.service';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class TwitchService {
  private readonly twitchApiUrl = 'https://api.twitch.tv/helix';
  private readonly clientId: string;

  // Axios instance
  private axiosInstance: AxiosInstance;

  constructor(
    private readonly connectedAccountsService: ConnectedAccountsService,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('TWITCH_CLIENT_ID') || '';
    
    if (!this.clientId) {
      console.warn('⚠️  TWITCH_CLIENT_ID not configured');
    }

    // Create axios instance with default config
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Client-Id': this.clientId,
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Get Twitch account data (access token and channel ID) for user
   */
  private async getTwitchAccount(userId: string): Promise<{ accessToken: string; externalChannelId: string }> {
    const accounts = await this.connectedAccountsService.findAll(userId);
    const twitchAccount = accounts.find((acc) => acc.platform === 'TWITCH');

    if (!twitchAccount) {
      throw new BadRequestException('No Twitch account connected');
    }

    return {
      accessToken: twitchAccount.accessToken,
      externalChannelId: twitchAccount.externalChannelId,
    };
  }

  /**
   * Get Twitch account access token for user
   */
  private async getTwitchAccessToken(userId: string): Promise<string> {
    const { accessToken } = await this.getTwitchAccount(userId);
    return accessToken;
  }

  /**
   * Calculate started_at for the current period
   * - For 'week': Returns Monday of the NEXT week (current Monday + 7 days) at 00:00:00 UTC
   * - For 'month': Returns the 1st day of the NEXT month at 00:00:00 UTC
   * - For other periods: Returns undefined (uses Twitch's default)
   */
  private calculateStartedAt(period: 'day' | 'week' | 'month' | 'all' | 'year'): string | undefined {
    const now = new Date();

    if (period === 'week') {
      // Get Monday of the current week
      const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() + daysToMonday);
      monday.setUTCHours(0, 0, 0, 0);
      
      // Add 7 days to get the Monday of the next week
      monday.setUTCDate(monday.getUTCDate() + 7);
      
      return monday.toISOString();
    }

    if (period === 'month') {
      // Get 1st day of the next month
      const firstDayNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
      return firstDayNextMonth.toISOString();
    }

    // For 'day', 'all', 'year' - don't send started_at (use Twitch's default)
    return undefined;
  }

  /**
   * Get Bits leaderboard from Twitch API
   * GET https://api.twitch.tv/helix/bits/leaderboard?period=week&started_at=2025-11-11T00:00:00.0Z
   * 
   * Note: For 'week' period, automatically calculates Monday of the current week
   * For 'month' period, automatically calculates the 1st day of the current month
   */
  async getBitsLeaderboard(
    userId: string,
    period: 'day' | 'week' | 'month' | 'all' | 'year',
    startedAt?: string,
  ): Promise<any> {
    try {
      const accessToken = await this.getTwitchAccessToken(userId);

      // Build params object
      const params: Record<string, any> = {
        period,
        count: 100,
      };

      // Use provided startedAt if given, otherwise calculate it automatically
      const finalStartedAt = startedAt || this.calculateStartedAt(period);
      
      if (finalStartedAt) {
        params.started_at = finalStartedAt;
      }


      const response = await this.axiosInstance.get(`${this.twitchApiUrl}/bits/leaderboard`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.clientId,
        },
        params,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error('Twitch API Error Response:', error.response.data);
        const errorText = JSON.stringify(error.response.data || error.response.statusText);
        throw new BadRequestException(`Failed to fetch bits leaderboard: ${errorText}`);
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching bits leaderboard:', error);
      throw new InternalServerErrorException('Failed to fetch bits leaderboard');
    }
  }

  /**
   * Get users by IDs from Twitch API
   * GET https://api.twitch.tv/helix/users?id=68490587&id=123
   */
  async getUsers(userId: string, userIds: string[]): Promise<any> {
    try {
      const accessToken = await this.getTwitchAccessToken(userId);

      if (!userIds || userIds.length === 0) {
        throw new BadRequestException('At least one user ID is required');
      }

      // Build query string manually for multiple id parameters
      const params = new URLSearchParams();
      userIds.forEach((id) => {
        params.append('id', id);
      });

      const response = await this.axiosInstance.get(
        `${this.twitchApiUrl}/users?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': this.clientId,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorText = JSON.stringify(error.response.data || error.response.statusText);
        throw new BadRequestException(`Failed to fetch users: ${errorText}`);
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching users:', error);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  /**
   * Get broadcaster subscriptions from Twitch API with pagination
   * GET https://api.twitch.tv/helix/subscriptions?broadcaster_id=68490587
   */
  async getBroadcasterSubscriptions(
    userId: string,
    broadcasterId: string,
    after?: string,
  ): Promise<any> {
    try {
      const { accessToken, externalChannelId } = await this.getTwitchAccount(userId);

      // If broadcaster_id is 'self', use the connected account's channel ID
      const resolvedBroadcasterId = broadcasterId === 'self' ? externalChannelId : broadcasterId;

      const params: any = {
        broadcaster_id: resolvedBroadcasterId,
        first: 100, // Maximum allowed
      };

      if (after) {
        params.after = after;
      }

      const response = await this.axiosInstance.get(`${this.twitchApiUrl}/subscriptions`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.clientId,
        },
        params,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorText = JSON.stringify(error.response.data || error.response.statusText);
        throw new BadRequestException(`Failed to fetch broadcaster subscriptions: ${errorText}`);
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching broadcaster subscriptions:', error);
      throw new InternalServerErrorException('Failed to fetch broadcaster subscriptions');
    }
  }

  /**
   * Get user subscription status (check if user is subscribed to broadcaster)
   * GET https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=X&user_id=Y
   * Requires: user:read:subscriptions scope from the BROADCASTER
   * 
   * Alternative: Use /subscriptions?broadcaster_id=X&user_id=Y (requires channel:read:subscriptions from broadcaster)
   */
  async getUserSubscription(
    userId: string,
    broadcasterId: string,
    subscriberUserId: string,
  ): Promise<any> {
    try {
      const { accessToken } = await this.getTwitchAccount(userId);

      // Try using /subscriptions endpoint (requires channel:read:subscriptions from broadcaster)
      const params: any = {
        broadcaster_id: broadcasterId,
        user_id: subscriberUserId,
      };

      const response = await this.axiosInstance.get(`${this.twitchApiUrl}/subscriptions`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.clientId,
        },
        params,
      });

      return response.data;
    } catch (error: any) {
      // 404 means user is not subscribed
      if (error.response?.status === 404) {
        console.log('ℹ️ [Twitch API] User is not subscribed (404)');
        return null;
      }
      // 401 means missing scope - log warning but don't throw
      if (error.response?.status === 401) {
        console.warn('⚠️ Missing Twitch scope: channel:read:subscriptions. Cannot check subscriber status. Treating as non-subscriber.');
        return null;
      }
      if (error.response) {
        const errorText = JSON.stringify(error.response.data || error.response.statusText);
        console.error('Twitch getUserSubscription error:', errorText);
        // Don't throw - just return null if we can't check subscription
        return null;
      }
      console.error('Error fetching user subscription:', error);
      return null;
    }
  }

  /**
   * Get all gifted subscriptions by a specific gifter
   * Uses pagination to fetch all subs and filters by gifter_id
   */
  async getGiftedSubsByGifter(
    userId: string,
    broadcasterId: string,
    gifterId: string,
  ): Promise<number> {
    try {
      const { accessToken } = await this.getTwitchAccount(userId);

      let totalGifted = 0;
      let cursor: string | undefined = undefined;
      let hasMore = true;

      // Busca todas as páginas
      while (hasMore) {
        const params: any = {
          broadcaster_id: broadcasterId,
          first: 100, // Máximo permitido
        };

        if (cursor) {
          params.after = cursor;
        }

        const response = await this.axiosInstance.get(`${this.twitchApiUrl}/subscriptions`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': this.clientId,
          },
          params,
        });

        const data = response.data;
        const subs = data.data || [];

        // Filtra e conta gift subs deste gifter
        const giftsFromUser = subs.filter(
          (sub: any) => sub.is_gift === true && sub.gifter_id === gifterId,
        );

        totalGifted += giftsFromUser.length;

        // Verifica se há mais páginas
        cursor = data.pagination?.cursor;
        hasMore = !!cursor;

        // Segurança: limite de 10 páginas (1000 subs) para evitar loop infinito
        if (!hasMore || totalGifted >= 1000) {
          break;
        }
      }

      console.log(`✅ [Twitch API] Total gifted subs by ${gifterId}: ${totalGifted}`);
      return totalGifted;
    } catch (error: any) {
      if (error.response) {
        const errorText = JSON.stringify(error.response.data || error.response.statusText);
        console.error('Twitch getGiftedSubsByGifter error:', errorText);
      }
      console.error('Error fetching gifted subs:', error);
      return 0;
    }
  }

  /**
   * Get user info by user ID (for avatar, display name, etc)
   * GET https://api.twitch.tv/helix/users?id=X
   */
  async getUserById(userId: string, targetUserId: string): Promise<any> {
    try {
      const accessToken = await this.getTwitchAccessToken(userId);

      const response = await this.axiosInstance.get(`${this.twitchApiUrl}/users`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.clientId,
        },
        params: {
          id: targetUserId,
        },
      });

      return response.data?.data?.[0] || null;
    } catch (error: any) {
      if (error.response) {
        const errorText = JSON.stringify(error.response.data || error.response.statusText);
        console.error('Twitch getUserById error:', errorText);
      }
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }
}
