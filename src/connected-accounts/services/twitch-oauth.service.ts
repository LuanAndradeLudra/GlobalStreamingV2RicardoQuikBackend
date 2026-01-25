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
      scope: 'channel:read:subscriptions user:read:subscriptions channel:read:redemptions channel:manage:redemptions user:read:email user:write:chat chat:read chat:edit bits:read user:read:chat user:bot channel:bot',
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

  /**
   * Get App Access Token
   * App Access Tokens are required to create EventSub subscriptions
   */
  async getAppAccessToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Twitch OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
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
        console.error('❌ [Twitch API] App token error:', errorText);
        throw new BadRequestException(`Failed to get app access token: ${errorText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error getting app access token:', error);
      throw new InternalServerErrorException('Failed to get app access token');
    }
  }

  /**
   * Create EventSub subscription
   * Requires App Access Token (not User Access Token)
   */
  async createEventSubSubscription(
    appAccessToken: string,
    subscriptionType: string,
    version: string,
    condition: Record<string, string>,
    webhookUrl: string,
    webhookSecret: string,
  ): Promise<any> {
    console.log('🔄 [Twitch EventSub] Creating subscription...');
    console.log('📝 [Twitch EventSub] Type:', subscriptionType);
    console.log('📝 [Twitch EventSub] Version:', version);
    console.log('📝 [Twitch EventSub] Condition:', condition);

    try {
      const response = await fetch(`${this.twitchApiUrl}/eventsub/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appAccessToken}`,
          'Client-Id': this.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: subscriptionType,
          version,
          condition,
          transport: {
            method: 'webhook',
            callback: webhookUrl,
            secret: webhookSecret,
          },
        }),
      });

      console.log('📥 [Twitch EventSub] Response status:', response.status);
      const responseText = await response.text();
      console.log('📥 [Twitch EventSub] Response:', responseText);

      if (!response.ok) {
        let errorMessage = `Failed to create subscription: ${responseText}`;
        
        // Provide more helpful error messages
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(responseText);
            if (errorData.message?.includes('subscription missing proper authorization')) {
              errorMessage = `Subscription authorization failed (403). This usually means:
1. The bot user (user_id) doesn't have permission to read chat messages in the channel
2. The bot is banned or timed out in the channel
3. Missing required scopes: user:read:chat, user:bot (for bot), and channel:bot (for broadcaster)
4. The broadcaster hasn't authorized your Client ID with channel:bot scope

Original error: ${responseText}`;
            }
          } catch (e) {
            // If parsing fails, use original message
          }
        }
        
        throw new BadRequestException(errorMessage);
      }

      return JSON.parse(responseText);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error creating EventSub subscription:', error);
      throw new InternalServerErrorException('Failed to create EventSub subscription');
    }
  }

  /**
   * Get active EventSub subscriptions
   */
  async getEventSubSubscriptions(appAccessToken: string, status?: string): Promise<any> {
    console.log('🔄 [Twitch EventSub] Fetching subscriptions...');

    try {
      const params = new URLSearchParams();
      if (status) {
        params.append('status', status);
      }

      const url = `${this.twitchApiUrl}/eventsub/subscriptions${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${appAccessToken}`,
          'Client-Id': this.clientId,
        },
      });

      console.log('📥 [Twitch EventSub] Subscriptions response status:', response.status);
      const responseText = await response.text();
      console.log('📥 [Twitch EventSub] Subscriptions response:', responseText);

      if (!response.ok) {
        throw new BadRequestException(`Failed to fetch subscriptions: ${responseText}`);
      }

      return JSON.parse(responseText);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching EventSub subscriptions:', error);
      throw new InternalServerErrorException('Failed to fetch EventSub subscriptions');
    }
  }

  /**
   * Delete EventSub subscription
   */
  async deleteEventSubSubscription(appAccessToken: string, subscriptionId: string): Promise<void> {
    console.log('🗑️ [Twitch EventSub] Deleting subscription:', subscriptionId);

    try {
      const response = await fetch(`${this.twitchApiUrl}/eventsub/subscriptions?id=${subscriptionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${appAccessToken}`,
          'Client-Id': this.clientId,
        },
      });

      console.log('📥 [Twitch EventSub] Delete response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new BadRequestException(`Failed to delete subscription: ${errorText}`);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error deleting EventSub subscription:', error);
      throw new InternalServerErrorException('Failed to delete EventSub subscription');
    }
  }

  /**
   * Subscribe to channel.chat.message EventSub
   * This is a convenience method specifically for chat messages
   */
  async subscribeToChatMessages(
    broadcasterUserId: string,
    botUserId: string,
    webhookUrl: string,
    webhookSecret: string,
  ): Promise<any> {
    console.log('🔄 [Twitch EventSub] Subscribing to chat messages...');
    console.log('📝 [Twitch EventSub] Broadcaster ID:', broadcasterUserId);
    console.log('📝 [Twitch EventSub] Bot User ID:', botUserId);

    const appAccessToken = await this.getAppAccessToken();

    return this.createEventSubSubscription(
      appAccessToken,
      'channel.chat.message',
      '1',
      {
        broadcaster_user_id: broadcasterUserId,
        user_id: botUserId,
      },
      webhookUrl,
      webhookSecret,
    );
  }

  /**
   * Subscribe to channel.cheer EventSub
   * This is a convenience method specifically for Bits donations
   */
  async subscribeToCheerEvents(
    broadcasterUserId: string,
    webhookUrl: string,
    webhookSecret: string,
  ): Promise<any> {
    console.log('🔄 [Twitch EventSub] Subscribing to cheer events (Bits)...');
    console.log('📝 [Twitch EventSub] Broadcaster ID:', broadcasterUserId);

    const appAccessToken = await this.getAppAccessToken();

    return this.createEventSubSubscription(
      appAccessToken,
      'channel.cheer',
      '1',
      {
        broadcaster_user_id: broadcasterUserId,
      },
      webhookUrl,
      webhookSecret,
    );
  }

  /**
   * Subscribe to channel.subscribe EventSub
   * This is a convenience method specifically for subscriptions (new subs and renewals)
   */
  async subscribeToSubscriptionEvents(
    broadcasterUserId: string,
    webhookUrl: string,
    webhookSecret: string,
  ): Promise<any> {
    console.log('🔄 [Twitch EventSub] Subscribing to subscription events...');
    console.log('📝 [Twitch EventSub] Broadcaster ID:', broadcasterUserId);

    const appAccessToken = await this.getAppAccessToken();

    return this.createEventSubSubscription(
      appAccessToken,
      'channel.subscribe',
      '1',
      {
        broadcaster_user_id: broadcasterUserId,
      },
      webhookUrl,
      webhookSecret,
    );
  }

  /**
   * Subscribe to channel.subscription.gift EventSub
   * This is a convenience method specifically for gift subscriptions (who GAVE the gifts)
   */
  async subscribeToGiftSubEvents(
    broadcasterUserId: string,
    webhookUrl: string,
    webhookSecret: string,
  ): Promise<any> {
    console.log('🔄 [Twitch EventSub] Subscribing to gift subscription events...');
    console.log('📝 [Twitch EventSub] Broadcaster ID:', broadcasterUserId);

    const appAccessToken = await this.getAppAccessToken();

    return this.createEventSubSubscription(
      appAccessToken,
      'channel.subscription.gift',
      '1',
      {
        broadcaster_user_id: broadcasterUserId,
      },
      webhookUrl,
      webhookSecret,
    );
  }

  /**
   * Subscribe to all webhook events (chat messages, bits, subscriptions, and gift subs)
   */
  async subscribeToAllWebhookEvents(
    broadcasterUserId: string,
    botUserId: string,
    webhookUrl: string,
    webhookSecret: string,
  ): Promise<{ chatMessages: any; cheerEvents: any; subscriptionEvents: any; giftSubEvents: any }> {
    console.log('🔄 [Twitch EventSub] Subscribing to all webhook events...');

    const results = {
      chatMessages: null as any,
      cheerEvents: null as any,
      subscriptionEvents: null as any,
      giftSubEvents: null as any,
    };

    // Subscribe to chat messages
    try {
      results.chatMessages = await this.subscribeToChatMessages(
        broadcasterUserId,
        botUserId,
        webhookUrl,
        webhookSecret,
      );
      console.log('✅ [Twitch EventSub] Successfully subscribed to chat messages');
    } catch (error) {
      console.error('❌ [Twitch EventSub] Failed to subscribe to chat messages:', error);
      throw error;
    }

    // Subscribe to cheer events
    try {
      results.cheerEvents = await this.subscribeToCheerEvents(
        broadcasterUserId,
        webhookUrl,
        webhookSecret,
      );
      console.log('✅ [Twitch EventSub] Successfully subscribed to cheer events');
    } catch (error) {
      console.error('❌ [Twitch EventSub] Failed to subscribe to cheer events:', error);
      // Continue even if cheer subscription fails
    }

    // Subscribe to subscription events
    try {
      results.subscriptionEvents = await this.subscribeToSubscriptionEvents(
        broadcasterUserId,
        webhookUrl,
        webhookSecret,
      );
      console.log('✅ [Twitch EventSub] Successfully subscribed to subscription events');
    } catch (error) {
      console.error('❌ [Twitch EventSub] Failed to subscribe to subscription events:', error);
      // Continue even if subscription fails
    }

    // Subscribe to gift sub events
    try {
      results.giftSubEvents = await this.subscribeToGiftSubEvents(
        broadcasterUserId,
        webhookUrl,
        webhookSecret,
      );
      console.log('✅ [Twitch EventSub] Successfully subscribed to gift sub events');
    } catch (error) {
      console.error('❌ [Twitch EventSub] Failed to subscribe to gift sub events:', error);
      // Continue even if gift sub subscription fails
    }

    return results;
  }

  /**
   * Update EventSub subscriptions
   * Deletes existing subscriptions and creates new ones
   */
  async updateEventSubSubscriptions(
    broadcasterUserId: string,
    botUserId: string,
    webhookUrl: string,
    webhookSecret: string,
  ): Promise<any> {
    console.log('🔄 [Twitch EventSub] Updating subscriptions...');

    try {
      const appAccessToken = await this.getAppAccessToken();

      // Get existing subscriptions
      const existingSubs = await this.getEventSubSubscriptions(appAccessToken);
      const subscriptions = existingSubs.data || [];

      console.log('📋 [Twitch EventSub] Existing subscriptions:', JSON.stringify(subscriptions, null, 2));

      // Delete all existing subscriptions for this broadcaster
      if (subscriptions.length > 0) {
        console.log(`🗑️ [Twitch EventSub] Deleting ${subscriptions.length} existing subscriptions...`);
        await Promise.all(
          subscriptions
            .filter((sub: any) => {
              // Only delete subscriptions for this broadcaster
              return sub.condition?.broadcaster_user_id === broadcasterUserId;
            })
            .map((sub: any) => {
              const subscriptionId = sub.id;
              if (!subscriptionId) {
                console.warn(`⚠️ [Twitch EventSub] Subscription has no ID:`, JSON.stringify(sub, null, 2));
                return Promise.resolve();
              }
              console.log(`🗑️ [Twitch EventSub] Deleting subscription: ${subscriptionId} (type: ${sub.type})`);
              return this.deleteEventSubSubscription(appAccessToken, subscriptionId).catch((err) => {
                console.warn(`⚠️ [Twitch EventSub] Failed to delete subscription ${subscriptionId}:`, err);
              });
            }),
        );
      }

      // Create new subscriptions (chat messages and bits)
      console.log('✅ [Twitch EventSub] Creating new subscriptions...');
      return await this.subscribeToAllWebhookEvents(broadcasterUserId, botUserId, webhookUrl, webhookSecret);
    } catch (error) {
      console.error('Error updating EventSub subscriptions:', error);
      throw error;
    }
  }
}

