import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConnectedAccountsService } from '../connected-accounts/connected-accounts.service';
import { KickOAuthService } from '../connected-accounts/services/kick-oauth.service';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class KickService {
  private readonly kickApiUrl = 'https://api.kick.com/public/v1';
  private readonly kickApiV2Url = 'https://kick.com/api/v2';
  private readonly kickApiV1Url = 'https://kick.com/api/v1';

  // Axios instance with cookie support
  private axiosInstance: AxiosInstance;

  constructor(
    private readonly connectedAccountsService: ConnectedAccountsService,
    private readonly kickOAuthService: KickOAuthService,
  ) {
    // Create axios instance with default config
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      withCredentials: true, // Enable cookie handling
    });
  }

  /**
   * Get Kick account access token for user
   */
  private async getKickAccessToken(userId: string): Promise<string> {
    const accounts = await this.connectedAccountsService.findAll(userId);
    const kickAccount = accounts.find((acc) => acc.platform === 'KICK');

    if (!kickAccount) {
      throw new BadRequestException('No Kick account connected');
    }

    return kickAccount.accessToken;
  }

  /**
   * Get Cloudflare cookies by making an initial request
   */
  private async getCloudflareCookies(): Promise<void> {
    try {
      // Make a request to kick.com to get Cloudflare cookies
      await this.axiosInstance.get('https://kick.com', {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });
      console.log('✅ [Kick API] Cloudflare cookies obtained');
    } catch (error) {
      console.warn('⚠️ [Kick API] Failed to get Cloudflare cookies:', error);
    }
  }

  /**
   * Get Kick coins leaderboard
   * GET https://api.kick.com/public/v1/kicks/leaderboard
   */
  async getKickCoinsLeaderboard(userId: string): Promise<any> {
    try {
      const accessToken = await this.getKickAccessToken(userId);

      const response = await this.axiosInstance.get(`${this.kickApiUrl}/kicks/leaderboard`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching kick coins leaderboard:', error);
    }
  }

  /**
   * Get users by IDs
   * GET https://api.kick.com/public/v1/users?id=123&id=456
   */
  async getUsers(userId: string, userIds: number[]): Promise<any> {
    try {
      const accessToken = await this.getKickAccessToken(userId);

      // Build query string manually for multiple id parameters
      const params = new URLSearchParams();
      userIds.forEach((id) => {
        params.append('id', id.toString());
      });

      const response = await this.axiosInstance.get(
        `${this.kickApiUrl}/users?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
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
   * Get gift subs leaderboard for a channel
   * GET https://kick.com/api/v2/channels/{channelName}/leaderboards
   */
  async getGiftSubsLeaderboard(
    userId: string,
    channelName: string,
    browserHeaders: Record<string, string>,
  ): Promise<any> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${await this.getKickAccessToken(userId)}`,
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://kick.com',
        Referer: `https://kick.com/${channelName}`,
        'User-Agent': browserHeaders['user-agent'],
        'Accept-Language': browserHeaders['accept-language'],
      };

      const response = await this.axiosInstance.get(
        `${this.kickApiV2Url}/channels/${channelName}/leaderboards`,
        {
          headers: headers,
        },
      );

      return response.data;
    } catch (error: any) {
      console.error('Error fetching gift subs leaderboard:', error);
    }
  }

  /**
   * Get channel information
   * GET https://kick.com/api/v1/channels/{channelName}
   */
  async getChannel(userId: string, channelName: string, browserHeaders: Record<string, string>): Promise<any> {
    try {
      const accessToken = await this.getKickAccessToken(userId);

      // Get Cloudflare cookies first
      await this.getCloudflareCookies();

      const url = `${this.kickApiV1Url}/channels/${channelName}`;

      console.log('🔍 [Kick API] Request URL:', url);

      const response = await this.axiosInstance.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json, text/plain, */*',
          Origin: 'https://kick.com',
          Referer: `https://kick.com/${channelName}`,
          'User-Agent': browserHeaders['user-agent'],
          'Accept-Language': browserHeaders['accept-language'],
        },
      });

      console.log('📥 [Kick API] Response status:', response.status);

      return response.data;
    } catch (error: any) {
      // If we get 403, try to refresh cookies and retry once
      if (error.response?.status === 403) {
        console.log('🔄 [Kick API] Got 403, refreshing Cloudflare cookies and retrying...');
        await this.getCloudflareCookies();

        try {
          const retryResponse = await this.axiosInstance.get(
            `${this.kickApiV1Url}/channels/${channelName}`,
            {
              headers: {
                Authorization: `Bearer ${await this.getKickAccessToken(userId)}`,
                Accept: 'application/json, text/plain, */*',
                Origin: 'https://kick.com',
                Referer: `https://kick.com/${channelName}`,
              },
            },
          );

          return retryResponse.data;
        } catch (retryError: any) {
          const errorText = JSON.stringify(retryError.response?.data || retryError.message);
          console.error('❌ [Kick API] Error response after retry:', errorText);
          throw new BadRequestException(`Failed to fetch channel: ${errorText}`);
        }
      }

      if (error.response) {
        const errorText = JSON.stringify(error.response.data || error.response.statusText);
        throw new BadRequestException(`Failed to fetch channel: ${errorText}`);
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching channel:', error);
      throw new InternalServerErrorException('Failed to fetch channel');
    }
  }

  /**
   * Send a chat message to a Kick channel
   * Moved from connected-accounts controller
   */
  async sendChatMessage(
    userId: string,
    message: string,
    channelId?: number,
    type: 'user' | 'bot' = 'user',
    replyToMessageId?: string,
  ): Promise<any> {
    try {
      const accounts = await this.connectedAccountsService.findAll(userId);
      const kickAccount = accounts.find((acc) => acc.platform === 'KICK');

      if (!kickAccount) {
        throw new BadRequestException('No Kick account connected');
      }

      // Check if chat:write scope is present
      const scopes = kickAccount.scopes?.split(' ') || [];
      if (!scopes.includes('chat:write')) {
        throw new BadRequestException(
          'Missing chat:write scope. Please reconnect your Kick account with chat:write permission.',
        );
      }

      const broadcasterUserId = channelId || parseInt(kickAccount.externalChannelId);
      const trimmedMessage = message?.trim();

      if (!trimmedMessage || trimmedMessage.length === 0) {
        throw new BadRequestException('Message cannot be empty');
      }

      if (trimmedMessage.length > 500) {
        throw new BadRequestException('Message cannot exceed 500 characters');
      }

      if (type !== 'user' && type !== 'bot') {
        throw new BadRequestException('Type must be either "user" or "bot"');
      }

      console.log('💬 [Kick Chat] Sending message to channel:', broadcasterUserId);
      console.log('💬 [Kick Chat] Message:', trimmedMessage);
      console.log('💬 [Kick Chat] Type:', type);

      const result = await this.kickOAuthService.sendChatMessage(
        kickAccount.accessToken,
        broadcasterUserId,
        trimmedMessage,
        type,
        replyToMessageId,
      );

      return {
        success: true,
        message: 'Chat message sent successfully',
        data: result,
      };
    } catch (error: unknown) {
      console.error('Error sending chat message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to send chat message: ${errorMessage}`);
    }
  }
}