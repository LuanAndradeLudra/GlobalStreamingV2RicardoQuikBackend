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
   * Get Twitch account access token for user
   */
  private async getTwitchAccessToken(userId: string): Promise<string> {
    const accounts = await this.connectedAccountsService.findAll(userId);
    const twitchAccount = accounts.find((acc) => acc.platform === 'TWITCH');

    if (!twitchAccount) {
      throw new BadRequestException('No Twitch account connected');
    }

    return twitchAccount.accessToken;
  }

  /**
   * Calculate started_at for the current period
   * - For 'week': Returns Monday of the NEXT week (current Monday + 7 days) at 00:00:00 UTC
   *   This is because Twitch API requires started_at to be the Monday of next week
   * - For 'month': Returns the 1st day of the current month at 00:00:00 UTC
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
      // Get 1st day of the current month
      const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      return firstDay.toISOString();
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

      console.log('Fetching bits leaderboard with params:', params);

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
      const accessToken = await this.getTwitchAccessToken(userId);

      const params: any = {
        broadcaster_id: broadcasterId,
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
}
