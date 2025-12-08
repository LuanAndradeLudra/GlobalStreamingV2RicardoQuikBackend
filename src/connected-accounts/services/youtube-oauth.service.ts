import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import * as crypto from 'crypto';

interface YouTubeTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface YouTubeChannelInfo {
  id: string;
  title: string;
  description?: string;
  customUrl?: string;
  publishedAt: string;
  thumbnails?: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
}

@Injectable()
export class YouTubeOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly youtubeApiUrl = 'https://www.googleapis.com/youtube/v3';
  private readonly googleOAuthUrl = 'https://accounts.google.com/o/oauth2/v2';
  private readonly googleTokenUrl = 'https://oauth2.googleapis.com/token';

  // Store state temporarily (in production, use Redis or database)
  private readonly stateStore = new Map<string, { userId: string; timestamp: number }>();

  constructor(private readonly configService: ConfigService) {
    // Reuse Google OAuth credentials (same OAuth app, different scopes)
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    // YouTube callback URL is different from auth callback
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    this.redirectUri = `${backendUrl.replace(/\/$/, '')}/api/connected-accounts/oauth/youtube/callback`;

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        '⚠️  YouTube OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables (reuses Google OAuth credentials).',
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
   * Generate authorization URL for YouTube OAuth
   * Required scopes:
   * - youtube.readonly: Read chat messages from live streams
   * - youtube.force-ssl: Required for YouTube Data API v3
   */
  getAuthorizationUrl(state: string): string {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException('YouTube OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
      access_type: 'offline', // Required to get refresh_token
      prompt: 'consent', // Force consent screen to ensure refresh_token is returned
      state,
    });

    const url = `${this.googleOAuthUrl}/auth?${params.toString()}`;
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
  ): Promise<{ tokenResponse: YouTubeTokenResponse; channelInfo: YouTubeChannelInfo }> {
    console.log('🔄 [YouTube OAuth] Starting token exchange...');
    console.log('📝 [YouTube OAuth] Code length:', code?.length || 0);

    if (!this.clientId || !this.clientSecret) {
      console.error('❌ [YouTube OAuth] Configuration missing');
      throw new BadRequestException('YouTube OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
    });

    console.log('🌐 [YouTube OAuth] Requesting token from:', this.googleTokenUrl);

    try {
      const response = await fetch(this.googleTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      console.log('📥 [YouTube OAuth] Token response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [YouTube OAuth] Token exchange error:', errorText);
        console.error('❌ [YouTube OAuth] Error status:', response.status);
        throw new BadRequestException(`Failed to exchange code for token: ${errorText}`);
      }

      const tokenResponse: YouTubeTokenResponse = await response.json();
      console.log('✅ [YouTube OAuth] Token received successfully');
      console.log('📝 [YouTube OAuth] Token response:', {
        token_type: tokenResponse.token_type,
        expires_in: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        has_refresh_token: !!tokenResponse.refresh_token,
        access_token_length: tokenResponse.access_token?.length || 0,
      });

      // Fetch channel information
      console.log('🔄 [YouTube OAuth] Fetching channel information...');
      const channelInfo = await this.getChannelInfo(tokenResponse.access_token);
      console.log('✅ [YouTube OAuth] Channel info received:', {
        id: channelInfo.id,
        title: channelInfo.title,
        customUrl: channelInfo.customUrl,
      });

      return { tokenResponse, channelInfo };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('❌ [YouTube OAuth] Error exchanging code for token:', error);
      throw new InternalServerErrorException('Failed to exchange code for token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<YouTubeTokenResponse> {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('YouTube OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    try {
      const response = await fetch(this.googleTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('YouTube token refresh error:', errorText);
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
   * Get channel information using access token
   */
  async getChannelInfo(accessToken: string): Promise<YouTubeChannelInfo> {
    console.log('🔍 [YouTube API] Starting to fetch channel info...');
    console.log('📝 [YouTube API] Access token length:', accessToken?.length || 0);

    try {
      const response = await fetch(`${this.youtubeApiUrl}/channels?part=snippet&mine=true`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      console.log(`📥 [YouTube API] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [YouTube API] Error: ${errorText}`);
        throw new BadRequestException(`Failed to fetch channel info: ${errorText}`);
      }

      const data = await response.json();
      const channels = data.items || [];

      if (channels.length === 0) {
        throw new BadRequestException('No channel data returned from YouTube API');
      }

      const channel = channels[0];
      const snippet = channel.snippet || {};

      console.log(`✅ [YouTube API] Channel data received:`, JSON.stringify(channel, null, 2));

      return {
        id: channel.id,
        title: snippet.title || '',
        description: snippet.description,
        customUrl: snippet.customUrl,
        publishedAt: snippet.publishedAt || '',
        thumbnails: snippet.thumbnails,
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
   * Get OAuth2 client for YouTube API
   */
  getOAuth2Client(refreshToken?: string): any {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri,
    );

    if (refreshToken) {
      oauth2Client.setCredentials({ refresh_token: refreshToken });
    }

    return oauth2Client;
  }

  /**
   * Get YouTube API client with authentication
   */
  getYouTubeClient(accessToken: string): any {
    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.youtube({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);

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
