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
   * Get Bits leaderboard from Twitch API
   * GET https://api.twitch.tv/helix/bits/leaderboard?period=week&started_at=2025-11-11T00:00:00.0Z
   */
  async getBitsLeaderboard(
    userId: string,
    period: 'day' | 'week' | 'month' | 'all' | 'year',
    startedAt?: string,
  ): Promise<any> {
    try {
      const accessToken = await this.getTwitchAccessToken(userId);

      const params: any = {
        period,
        count: 100,
      };

      if (startedAt) {
        params.started_at = startedAt;
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
