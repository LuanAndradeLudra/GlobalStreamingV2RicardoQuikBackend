import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface KickTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

interface KickChannelInfo {
  id: number;
  user_id: number;
  slug: string;
  username: string;
  display_name: string;
}

interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

@Injectable()
export class KickOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly kickApiUrl = 'https://api.kick.com/public/v1';
  private readonly kickOAuthUrl = 'https://id.kick.com';

  // Store PKCE pairs temporarily (in production, use Redis or database)
  private readonly pkceStore = new Map<string, PKCEPair>();

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('KICK_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('KICK_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('KICK_REDIRECT_URI') || '';

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn(
        '⚠️  Kick OAuth not configured. Set KICK_CLIENT_ID, KICK_CLIENT_SECRET, and KICK_REDIRECT_URI environment variables.',
      );
    }
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCE(): PKCEPair {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    return {
      codeVerifier,
      codeChallenge,
    };
  }

  /**
   * Generate authorization URL for Kick OAuth
   */
  getAuthorizationUrl(state: string): { url: string; codeVerifier: string } {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException('Kick OAuth not configured');
    }

    const { codeVerifier, codeChallenge } = this.generatePKCE();

    // Store PKCE pair with state as key
    this.pkceStore.set(state, { codeVerifier, codeChallenge });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'user:read channel:read chat:write events:subscribe kicks:read',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    const url = `${this.kickOAuthUrl}/oauth/authorize?${params.toString()}`;

    return { url, codeVerifier };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    state: string,
  ): Promise<{ tokenResponse: KickTokenResponse; channelInfo: KickChannelInfo }> {
    console.log('🔄 [Kick OAuth] Starting token exchange...');
    console.log('📝 [Kick OAuth] Code length:', code?.length || 0);
    console.log('📝 [Kick OAuth] State:', state?.substring(0, 20) + '...');

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.error('❌ [Kick OAuth] Configuration missing');
      throw new BadRequestException('Kick OAuth not configured');
    }

    const pkcePair = this.pkceStore.get(state);
    if (!pkcePair) {
      console.error('❌ [Kick OAuth] PKCE pair not found for state');
      throw new BadRequestException('Invalid state or expired PKCE challenge');
    }

    console.log('✅ [Kick OAuth] PKCE pair found');

    // Remove used PKCE pair
    this.pkceStore.delete(state);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code_verifier: pkcePair.codeVerifier,
      code,
    });

    console.log('🌐 [Kick OAuth] Requesting token from:', `${this.kickOAuthUrl}/oauth/token`);
    console.log('📤 [Kick OAuth] Request params:', {
      grant_type: 'authorization_code',
      client_id: this.clientId.substring(0, 10) + '...',
      redirect_uri: this.redirectUri,
      code_length: code.length,
    });

    try {
      const response = await fetch(`${this.kickOAuthUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      console.log('📥 [Kick OAuth] Token response status:', response.status);
      console.log('📥 [Kick OAuth] Token response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Kick OAuth] Token exchange error:', errorText);
        console.error('❌ [Kick OAuth] Error status:', response.status);
        throw new BadRequestException(`Failed to exchange code for token: ${errorText}`);
      }

      const tokenResponse: KickTokenResponse = await response.json();
      console.log('✅ [Kick OAuth] Token received successfully');
      console.log('📝 [Kick OAuth] Token response:', {
        token_type: tokenResponse.token_type,
        expires_in: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        has_refresh_token: !!tokenResponse.refresh_token,
        access_token_length: tokenResponse.access_token?.length || 0,
      });

      // Fetch channel information
      console.log('🔄 [Kick OAuth] Fetching channel information...');
      const channelInfo = await this.getChannelInfo(tokenResponse.access_token);
      console.log('✅ [Kick OAuth] Channel info received:', {
        id: channelInfo.id,
        username: channelInfo.username,
        display_name: channelInfo.display_name,
      });

      return { tokenResponse, channelInfo };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('❌ [Kick OAuth] Error exchanging code for token:', error);
      throw new InternalServerErrorException('Failed to exchange code for token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<KickTokenResponse> {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Kick OAuth not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    try {
      const response = await fetch(`${this.kickOAuthUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Kick token refresh error:', errorText);
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
   * Note: This is optional - if it fails, we'll use basic info from the token
   */
  async getChannelInfo(accessToken: string): Promise<KickChannelInfo> {
    console.log('🔍 [Kick API] Starting to fetch channel info...');
    console.log('📝 [Kick API] Access token length:', accessToken?.length || 0);
    console.log('📝 [Kick API] Access token preview:', accessToken?.substring(0, 20) + '...');
    console.log('🌐 [Kick API] Base URL:', this.kickApiUrl);

    // According to Kick API docs: GET /users without params returns the authenticated user
    // Requires 'user:read' scope
    const endpoint = `${this.kickApiUrl}/users`;

    let userData: any = null;
    let lastError: string | null = null;
    let lastStatus: number | null = null;

    console.log(`🔄 [Kick API] Fetching user info from: ${endpoint}`);
    try {
      const userResponse = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      console.log(`📥 [Kick API] Response from ${endpoint}:`);
      console.log(`   Status: ${userResponse.status} ${userResponse.statusText}`);
      console.log(`   Headers:`, Object.fromEntries(userResponse.headers.entries()));

      if (userResponse.ok) {
        const responseText = await userResponse.text();
        console.log(`✅ [Kick API] Success! Response body:`, responseText.substring(0, 500));
        try {
          const responseJson = JSON.parse(responseText);
          // Kick API returns { data: [...], message: "..." }
          // When no IDs provided, returns array with single user (authenticated user)
          if (responseJson.data && Array.isArray(responseJson.data) && responseJson.data.length > 0) {
            userData = responseJson.data[0]; // Get first user (authenticated user)
            console.log(`✅ [Kick API] Parsed user data:`, JSON.stringify(userData, null, 2));
          } else {
            console.warn(`⚠️ [Kick API] Unexpected response format:`, responseJson);
            lastError = 'Unexpected response format';
            lastStatus = userResponse.status;
          }
        } catch (parseError) {
          console.error(`❌ [Kick API] Failed to parse JSON:`, parseError);
          lastError = `Invalid JSON response: ${responseText.substring(0, 200)}`;
          lastStatus = userResponse.status;
        }
      } else {
        const errorText = await userResponse.text();
        lastError = errorText;
        lastStatus = userResponse.status;
        console.error(`❌ [Kick API] Endpoint ${endpoint} failed:`);
        console.error(`   Status: ${userResponse.status}`);
        console.error(`   Response:`, errorText.substring(0, 500));
      }
    } catch (err) {
      console.error(`❌ [Kick API] Error fetching from ${endpoint}:`, err);
      lastError = err instanceof Error ? err.message : String(err);
    }

    // If we couldn't get user info, return minimal info
    // The user can update this later or we can fetch it when needed
    if (!userData) {
      console.warn('⚠️ [Kick API] Could not fetch user info from any endpoint');
      console.warn('⚠️ [Kick API] Last error:', lastError);
      console.warn('⚠️ [Kick API] Last status:', lastStatus);
      console.warn('⚠️ [Kick API] Using placeholder data - account will be saved but may need manual update');
      // Return placeholder - we'll use the access token to identify the account
      // The user can manually update the display name later if needed
      return {
        id: 0, // Will be set when we can fetch the actual ID
        user_id: 0,
        slug: '',
        username: '',
        display_name: 'Kick Account', // Placeholder
      };
    }

    // According to Kick API docs, user object has: user_id, name, email, profile_picture
    const userId = userData.user_id || userData.id || 0;
    const username = userData.name || userData.username || userData.slug || '';
    const displayName = userData.name || userData.display_name || userData.username || username || 'Kick Account';

    // Try to get channel info by username/slug if we have it
    let channelData = null;
    if (username) {
      try {
        const channelResponse = await fetch(`${this.kickApiUrl}/channels/${username}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        });

        if (channelResponse.ok) {
          channelData = await channelResponse.json();
        }
      } catch (err) {
        // If channel endpoint fails, we'll use user data
        console.warn('Could not fetch channel info:', err);
      }
    }

    // Use channel data if available, otherwise use user data
    const finalDisplayName = channelData?.user?.username || channelData?.user?.display_name || displayName;
    const channelId = channelData?.id || userId;

    return {
      id: channelId || userId || 0,
      user_id: userId || 0,
      slug: channelData?.slug || username || '',
      username: username || '',
      display_name: finalDisplayName,
    };
  }

  /**
   * Get user's channels (for verification)
   */
  async getUserChannels(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.kickApiUrl}/channels`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new BadRequestException(`Failed to fetch channels: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching channels:', error);
      throw new InternalServerErrorException('Failed to fetch channels');
    }
  }

  /**
   * Send a chat message to a Kick channel
   * Requires chat:write scope
   * 
   * According to https://docs.kick.com/apis/chat:
   * - POST /public/v1/chat
   * - Body: { broadcaster_user_id, content, type: "user" | "bot", reply_to_message_id? }
   * - When sending as user, broadcaster_user_id is required
   * - When sending as bot, broadcaster_user_id is ignored
   */
  async sendChatMessage(
    accessToken: string,
    broadcasterUserId: number,
    message: string,
    type: 'user' | 'bot' = 'user',
    replyToMessageId?: string,
  ): Promise<any> {
    console.log('💬 [Kick OAuth] Sending chat message...');
    console.log('📝 [Kick OAuth] Broadcaster User ID:', broadcasterUserId);
    console.log('📝 [Kick OAuth] Message:', message);
    console.log('📝 [Kick OAuth] Type:', type);

    try {
      const body: any = {
        content: message,
        type: type,
      };

      // broadcaster_user_id is required when type is "user"
      // When type is "bot", broadcaster_user_id should NOT be included (it's ignored anyway)
      if (type === 'user') {
        body.broadcaster_user_id = broadcasterUserId;
      }
      // When type is "bot", don't include broadcaster_user_id at all

      // Optional reply_to_message_id
      if (replyToMessageId) {
        body.reply_to_message_id = replyToMessageId;
      }

      console.log('📤 [Kick OAuth] Request body:', JSON.stringify(body, null, 2));

      const url = `${this.kickApiUrl}/chat`;
      console.log('📤 [Kick OAuth] Request URL:', url);
      console.log('📤 [Kick OAuth] Request body:', JSON.stringify(body, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('📥 [Kick OAuth] Send message response status:', response.status);
      const responseText = await response.text();
      console.log('📥 [Kick OAuth] Send message response:', responseText);

      if (!response.ok) {
        // Log more details for debugging
        console.error('❌ [Kick OAuth] Error details:', {
          status: response.status,
          statusText: response.statusText,
          responseText,
          requestBody: body,
          type,
        });
        throw new BadRequestException(`Failed to send chat message: ${responseText}`);
      }

      return JSON.parse(responseText);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error sending chat message:', error);
      throw new InternalServerErrorException('Failed to send chat message');
    }
  }
}

