import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface TwitchTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: string;
}

interface TwitchUserInfo {
  id: string;
  login: string;
  display_name: string;
  profile_image_url?: string;
  email?: string;
}

interface TwitchChannelInfo {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
}

@Injectable()
export class TwitchOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly twitchApiUrl = 'https://api.twitch.tv/helix';
  private readonly twitchOAuthUrl = 'https://id.twitch.tv';

  // Store state temporarily (in production, use Redis or database)
  private readonly stateStore = new Map<string, { userId: string; timestamp: number }>();

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('TWITCH_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('TWITCH_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('TWITCH_REDIRECT_URI') || '';

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn(
        '⚠️  Twitch OAuth not configured. Set TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, and TWITCH_REDIRECT_URI environment variables.',
      );
    }

    // Clean up expired states every 10 minutes
    setInterval(() => {
      const now = Date.now();
      const expirationTime = 10 * 60 * 1000; // 10 minutes
      for (const [state, data] of this.stateStore.entries()) {
        if (now - data.timestamp > expirationTime) {
          this.stateStore.delete(state);
        }
      }
    }, 10 * 60 * 1000);
  }

  /**
   * Generate authorization URL for Twitch OAuth
   */
  getAuthorizationUrl(state: string): string {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException('Twitch OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'channel:read:subscriptions channel:read:redemptions channel:manage:redemptions user:read:email user:write:chat chat:read chat:edit bits:read',
      state,
    });

    const url = `${this.twitchOAuthUrl}/oauth2/authorize?${params.toString()}`;
    return url;
  }

  /**
   * Validate state and return userId
   */
  validateState(state: string): string {
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new BadRequestException('Invalid or expired state');
    }

    // Remove used state
    this.stateStore.delete(state);

    // Check expiration (10 minutes)
    const now = Date.now();
    const expirationTime = 10 * 60 * 1000;
    if (now - stateData.timestamp > expirationTime) {
      throw new BadRequestException('State expired');
    }

    return stateData.userId;
  }

  /**
   * Store state with userId
   */
  storeState(state: string, userId: string): void {
    this.stateStore.set(state, { userId, timestamp: Date.now() });
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
  ): Promise<{ tokenResponse: TwitchTokenResponse; userInfo: TwitchUserInfo }> {
    console.log('🔄 [Twitch OAuth] Starting token exchange...');
    console.log('📝 [Twitch OAuth] Code length:', code?.length || 0);

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.error('❌ [Twitch OAuth] Configuration missing');
      throw new BadRequestException('Twitch OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
    });

    console.log('🌐 [Twitch OAuth] Requesting token from:', `${this.twitchOAuthUrl}/oauth2/token`);

    try {
      const response = await fetch(`${this.twitchOAuthUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      console.log('📥 [Twitch OAuth] Token response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Twitch OAuth] Token exchange error:', errorText);
        console.error('❌ [Twitch OAuth] Error status:', response.status);
        throw new BadRequestException(`Failed to exchange code for token: ${errorText}`);
      }

      const tokenResponse: TwitchTokenResponse = await response.json();
      console.log('✅ [Twitch OAuth] Token received successfully');
      console.log('📝 [Twitch OAuth] Token response:', {
        token_type: tokenResponse.token_type,
        expires_in: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        has_refresh_token: !!tokenResponse.refresh_token,
        access_token_length: tokenResponse.access_token?.length || 0,
      });

      // Fetch user information
      console.log('🔄 [Twitch OAuth] Fetching user information...');
      const userInfo = await this.getUserInfo(tokenResponse.access_token);
      console.log('✅ [Twitch OAuth] User info received:', {
        id: userInfo.id,
        login: userInfo.login,
        display_name: userInfo.display_name,
      });

      return { tokenResponse, userInfo };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('❌ [Twitch OAuth] Error exchanging code for token:', error);
      throw new InternalServerErrorException('Failed to exchange code for token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TwitchTokenResponse> {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Twitch OAuth not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    try {
      const response = await fetch(`${this.twitchOAuthUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Twitch token refresh error:', errorText);
        throw new BadRequestException(`Failed to refresh token: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error refreshing token:', error);
      throw new InternalServerErrorException('Failed to refresh token');
    }
  }

  /**
   * Get user information using access token
   */
  async getUserInfo(accessToken: string): Promise<TwitchUserInfo> {
    console.log('🔍 [Twitch API] Starting to fetch user info...');
    console.log('📝 [Twitch API] Access token length:', accessToken?.length || 0);

    try {
      const response = await fetch(`${this.twitchApiUrl}/users`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.clientId,
        },
      });

      console.log(`📥 [Twitch API] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Twitch API] Error: ${errorText}`);
        throw new BadRequestException(`Failed to fetch user info: ${errorText}`);
      }

      const data = await response.json();
      const users = data.data || [];

      if (users.length === 0) {
        throw new BadRequestException('No user data returned from Twitch API');
      }

      const user = users[0];
      console.log(`✅ [Twitch API] User data received:`, JSON.stringify(user, null, 2));

      return {
        id: user.id,
        login: user.login,
        display_name: user.display_name || user.login,
        profile_image_url: user.profile_image_url,
        email: user.email,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching user info:', error);
      throw new InternalServerErrorException('Failed to fetch user info');
    }
  }

  /**
   * Get channel information for a broadcaster
   */
  async getChannelInfo(accessToken: string, broadcasterId: string): Promise<TwitchChannelInfo> {
    console.log('🔍 [Twitch API] Fetching channel info for broadcaster:', broadcasterId);

    try {
      const params = new URLSearchParams({
        broadcaster_id: broadcasterId,
      });

      const response = await fetch(`${this.twitchApiUrl}/channels?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.clientId,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Twitch API] Error fetching channel: ${errorText}`);
        throw new BadRequestException(`Failed to fetch channel info: ${errorText}`);
      }

      const data = await response.json();
      const channels = data.data || [];

      if (channels.length === 0) {
        throw new BadRequestException('No channel data returned from Twitch API');
      }

      const channel = channels[0];
      return {
        broadcaster_id: channel.broadcaster_id,
        broadcaster_login: channel.broadcaster_login,
        broadcaster_name: channel.broadcaster_name,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching channel info:', error);
      throw new InternalServerErrorException('Failed to fetch channel info');
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.twitchOAuthUrl}/oauth2/validate`, {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new BadRequestException('Invalid token');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error validating token:', error);
      throw new InternalServerErrorException('Failed to validate token');
    }
  }
}

