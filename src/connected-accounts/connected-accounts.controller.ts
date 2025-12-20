import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ConnectedAccountsService } from './connected-accounts.service';
import { CreateConnectedAccountDto } from './dto/create-connected-account.dto';
import { KickOAuthService } from './services/kick-oauth.service';
import { TwitchOAuthService } from './services/twitch-oauth.service';
import { YouTubeOAuthService } from './services/youtube-oauth.service';
import { YouTubeChatService } from '../youtube-chat/youtube-chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole, ConnectedAccount, ConnectedPlatform } from '@prisma/client';
import * as crypto from 'crypto';

@ApiTags('connected-accounts')
@Controller('connected-accounts')
export class ConnectedAccountsController {
  constructor(
    private readonly connectedAccountsService: ConnectedAccountsService,
    private readonly kickOAuthService: KickOAuthService,
    private readonly twitchOAuthService: TwitchOAuthService,
    private readonly youtubeOAuthService: YouTubeOAuthService,
    private readonly youtubeChatService: YouTubeChatService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List connected accounts',
    description: 'Returns all connected accounts for the authenticated admin user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of connected accounts',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
          externalChannelId: { type: 'string' },
          displayName: { type: 'string' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string', nullable: true },
          scopes: { type: 'string', nullable: true },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  async findAll(@CurrentUser() user: User): Promise<ConnectedAccount[]> {
    return this.connectedAccountsService.findAll(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or update connected account',
    description:
      'Creates a new connected account or updates an existing one for the authenticated admin user',
  })
  @ApiResponse({
    status: 201,
    description: 'Connected account created or updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
        externalChannelId: { type: 'string' },
        displayName: { type: 'string' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string', nullable: true },
        scopes: { type: 'string', nullable: true },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid payload',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  async createOrUpdate(
    @CurrentUser() user: User,
    @Body() createDto: CreateConnectedAccountDto,
  ): Promise<ConnectedAccount> {
    return this.connectedAccountsService.createOrUpdate(user.id, createDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete connected account',
    description: 'Removes a connected account for the authenticated admin user',
  })
  @ApiResponse({
    status: 204,
    description: 'Connected account deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Connected account not found',
  })
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.connectedAccountsService.remove(user.id, id);
  }

  @Get('oauth/kick/authorize')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-kick')
  @ApiOperation({
    summary: 'Initiate Kick OAuth flow',
    description: 'Returns Kick authorization URL or redirects to Kick authorization page',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to Kick authorization page (when accessed via browser)',
  })
  async initiateKickOAuth(
    @CurrentUser() user: User,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    try {
      // Generate state with user ID to ensure security
      const state = crypto.randomBytes(16).toString('hex');
      const stateWithUserId = `${state}:${user.id}`;

      const { url } = this.kickOAuthService.getAuthorizationUrl(stateWithUserId);

      // Check if request is from AJAX/fetch (has Accept: application/json header)
      const acceptHeader = req.headers.accept || '';
      const isJsonRequest = acceptHeader.includes('application/json');

      if (isJsonRequest) {
        // Return JSON for AJAX requests
        res.json({ url });
      } else {
        // Redirect for direct browser access
        res.redirect(url);
      }
    } catch (error) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const acceptHeader = req.headers.accept || '';
      const isJsonRequest = acceptHeader.includes('application/json');

      if (isJsonRequest) {
        res.status(500).json({
          error: 'kick_oauth_not_configured',
          message: 'Kick OAuth not configured',
        });
      } else {
        res.redirect(`${frontendUrl}/settings?error=kick_oauth_not_configured`);
      }
    }
  }

  @Public()
  @Get('oauth/kick/callback')
  @ApiTags('connected-accounts-kick')
  @ApiOperation({
    summary: 'Kick OAuth callback',
    description: 'Handles the callback from Kick OAuth flow',
  })
  @ApiQuery({ name: 'code', required: false, description: 'Authorization code from Kick' })
  @ApiQuery({ name: 'state', required: false, description: 'State parameter for security' })
  @ApiQuery({ name: 'error', required: false, description: 'Error from Kick OAuth' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to frontend with success or error',
  })
  async kickOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    console.log('🎯 [Kick OAuth Callback] Received callback');
    console.log('📝 [Kick OAuth Callback] Query params:', { code: code?.substring(0, 20) + '...', state, error });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    if (error) {
      console.error('❌ [Kick OAuth Callback] Error from Kick:', error);
      res.redirect(`${frontendUrl}/settings?error=kick_oauth_error&message=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      console.error('❌ [Kick OAuth Callback] Missing code or state');
      res.redirect(`${frontendUrl}/settings?error=kick_oauth_missing_params`);
      return;
    }

    try {
      // Decode URL-encoded state
      const decodedState = decodeURIComponent(state);
      console.log('📝 [Kick OAuth Callback] Decoded state:', decodedState.substring(0, 50) + '...');
      
      // Extract user ID from state
      const [stateValue, userId] = decodedState.split(':');
      console.log('📝 [Kick OAuth Callback] Extracted userId:', userId);
      
      if (!userId) {
        console.error('❌ [Kick OAuth Callback] Invalid state format - no userId found');
        res.redirect(`${frontendUrl}/settings?error=kick_oauth_invalid_state`);
        return;
      }

      console.log('🔄 [Kick OAuth Callback] Starting token exchange...');
      // Exchange code for token (use original state for PKCE validation)
      const { tokenResponse, channelInfo } = await this.kickOAuthService.exchangeCodeForToken(
        code,
        decodedState,
      );
      
      console.log('✅ [Kick OAuth Callback] Token exchange successful');

      // Calculate expiration date
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined;

      console.log('💾 [Kick OAuth Callback] Preparing to save connected account...');
      console.log('📝 [Kick OAuth Callback] Account data:', {
        platform: 'KICK',
        externalChannelId: channelInfo.id.toString(), // Use numeric ID
        displayName: channelInfo.slug || channelInfo.display_name || channelInfo.username, // Use slug
        hasAccessToken: !!tokenResponse.access_token,
        hasRefreshToken: !!tokenResponse.refresh_token,
        scopes: tokenResponse.scope,
        expiresAt: expiresAt?.toISOString(),
      });

      // Create or update connected account
      // For Kick: externalChannelId = numeric ID, displayName = slug/username
      const createDto: CreateConnectedAccountDto = {
        platform: 'KICK' as ConnectedPlatform,
        externalChannelId: channelInfo.id.toString(), // Numeric channel ID
        displayName: channelInfo.slug || channelInfo.display_name || channelInfo.username, // Slug for API calls
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        scopes: tokenResponse.scope,
        expiresAt: expiresAt?.toISOString(),
      };

      const savedAccount = await this.connectedAccountsService.createOrUpdate(userId, createDto);
      console.log('✅ [Kick OAuth Callback] Account saved successfully:', {
        id: savedAccount.id,
        platform: savedAccount.platform,
        displayName: savedAccount.displayName,
      });

      // Automatically subscribe to webhook events after successful OAuth
      try {
        console.log('🔔 [Kick OAuth Callback] Subscribing to webhook events...');
        const broadcasterUserId = parseInt(channelInfo.id.toString());
        
        // Subscribe to chat messages, subscriptions, and kicks gifted events
        const events = [
          { name: 'chat.message.sent', version: 1 },
          { name: 'channel.subscription.new', version: 1 },
          { name: 'kicks.gifted', version: 1 },
        ];

        await this.kickOAuthService.subscribeToEvents(
          tokenResponse.access_token,
          broadcasterUserId,
          events,
        );
        
        console.log('✅ [Kick OAuth Callback] Successfully subscribed to webhook events');
      } catch (webhookError) {
        // Log error but don't fail the OAuth flow
        console.error('⚠️ [Kick OAuth Callback] Failed to subscribe to webhooks:', webhookError);
        console.error('⚠️ [Kick OAuth Callback] Webhook subscription can be done manually later');
      }

      // Redirect to frontend with success
      console.log('🔄 [Kick OAuth Callback] Redirecting to frontend...');
      res.redirect(`${frontendUrl}/settings?success=kick_connected`);
    } catch (error: unknown) {
      console.error('Kick OAuth callback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(
        `${frontendUrl}/settings?error=kick_oauth_callback_failed&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  @Post('kick/subscribe-webhooks')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-kick')
  @ApiOperation({
    summary: 'Subscribe to Kick webhook events',
    description: 'Subscribes to Kick webhook events. Webhook URL is configured in Developer Dashboard.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully subscribed to webhook events',
  })
  async subscribeToKickWebhooks(
    @CurrentUser() user: User,
    @Body() body: { update?: boolean },
  ): Promise<any> {
    try {
      // Find Kick connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const kickAccount = accounts.find((acc) => acc.platform === 'KICK');

      if (!kickAccount) {
        throw new BadRequestException('No Kick account connected');
      }

      const broadcasterUserId = parseInt(kickAccount.externalChannelId);
      const events = [
        { name: 'chat.message.sent', version: 1 },
        { name: 'channel.subscription.new', version: 1 },
        { name: 'kicks.gifted', version: 1 },
      ];

      let result;
      if (body.update) {
        // Update: delete old subscriptions and create new ones
        result = await this.kickOAuthService.updateWebhookSubscriptions(
          kickAccount.accessToken,
          broadcasterUserId,
          events,
        );
      } else {
        // Just create new subscriptions
        result = await this.kickOAuthService.subscribeToEvents(
          kickAccount.accessToken,
          broadcasterUserId,
          events,
        );
      }

      return {
        success: true,
        message: 'Successfully subscribed to webhook events',
        data: result,
        note: 'Webhook URL is configured in Developer Dashboard: https://rosita-subjugal-annabella.ngrok-free.dev/api/webhooks/kick',
      };
    } catch (error: unknown) {
      console.error('Error subscribing to webhooks:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to subscribe to webhooks: ${errorMessage}`);
    }
  }

  @Get('kick/webhook-subscriptions')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-kick')
  @ApiOperation({
    summary: 'Get active Kick webhook subscriptions',
    description: 'Returns all active webhook subscriptions for the connected Kick account',
  })
  @ApiResponse({
    status: 200,
    description: 'Active subscriptions retrieved successfully',
  })
  async getKickWebhookSubscriptions(@CurrentUser() user: User): Promise<any> {
    try {
      // Find Kick connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const kickAccount = accounts.find((acc) => acc.platform === 'KICK');

      if (!kickAccount) {
        throw new BadRequestException('No Kick account connected');
      }

      const subscriptions = await this.kickOAuthService.getActiveSubscriptions(kickAccount.accessToken);
      const subscriptionsData = subscriptions.data || subscriptions;

      console.log('📋 [Kick Webhooks] Active subscriptions:', JSON.stringify(subscriptionsData, null, 2));

      return {
        success: true,
        count: Array.isArray(subscriptionsData) ? subscriptionsData.length : 0,
        subscriptions: subscriptionsData,
        webhookUrl: 'https://rosita-subjugal-annabella.ngrok-free.dev/api/webhooks/kick',
      };
    } catch (error: unknown) {
      console.error('Error fetching webhook subscriptions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to fetch subscriptions: ${errorMessage}`);
    }
  }

  @Get('oauth/twitch/authorize')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-twitch')
  @ApiOperation({
    summary: 'Initiate Twitch OAuth flow',
    description: 'Returns Twitch authorization URL or redirects to Twitch authorization page',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to Twitch authorization page (when accessed via browser)',
  })
  async initiateTwitchOAuth(
    @CurrentUser() user: User,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    try {
      // Generate state with user ID to ensure security
      const state = crypto.randomBytes(16).toString('hex');
      const stateWithUserId = `${state}:${user.id}`;

      // Store state for validation in callback
      this.twitchOAuthService.storeState(stateWithUserId, user.id);

      const url = this.twitchOAuthService.getAuthorizationUrl(stateWithUserId);

      // Check if request is from AJAX/fetch (has Accept: application/json header)
      const acceptHeader = req.headers.accept || '';
      const isJsonRequest = acceptHeader.includes('application/json');

      if (isJsonRequest) {
        // Return JSON for AJAX requests
        res.json({ url });
      } else {
        // Redirect for direct browser access
        res.redirect(url);
      }
    } catch (error) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const acceptHeader = req.headers.accept || '';
      const isJsonRequest = acceptHeader.includes('application/json');

      if (isJsonRequest) {
        res.status(500).json({
          error: 'twitch_oauth_not_configured',
          message: 'Twitch OAuth not configured',
        });
      } else {
        res.redirect(`${frontendUrl}/settings?error=twitch_oauth_not_configured`);
      }
    }
  }

  @Public()
  @Get('oauth/twitch/callback')
  @ApiTags('connected-accounts-twitch')
  @ApiOperation({
    summary: 'Twitch OAuth callback',
    description: 'Handles the callback from Twitch OAuth flow',
  })
  @ApiQuery({ name: 'code', required: false, description: 'Authorization code from Twitch' })
  @ApiQuery({ name: 'state', required: false, description: 'State parameter for security' })
  @ApiQuery({ name: 'error', required: false, description: 'Error from Twitch OAuth' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to frontend with success or error',
  })
  async twitchOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    console.log('🎯 [Twitch OAuth Callback] Received callback');
    console.log('📝 [Twitch OAuth Callback] Query params:', { code: code?.substring(0, 20) + '...', state, error });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    if (error) {
      console.error('❌ [Twitch OAuth Callback] Error from Twitch:', error);
      res.redirect(`${frontendUrl}/settings?error=twitch_oauth_error&message=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      console.error('❌ [Twitch OAuth Callback] Missing code or state');
      res.redirect(`${frontendUrl}/settings?error=twitch_oauth_missing_params`);
      return;
    }

    try {
      // Decode URL-encoded state
      const decodedState = decodeURIComponent(state);
      console.log('📝 [Twitch OAuth Callback] Decoded state:', decodedState.substring(0, 50) + '...');

      // Validate state and extract userId
      const userId = this.twitchOAuthService.validateState(decodedState);
      console.log('📝 [Twitch OAuth Callback] Extracted userId:', userId);

      console.log('🔄 [Twitch OAuth Callback] Starting token exchange...');
      // Exchange code for token
      const { tokenResponse, userInfo } = await this.twitchOAuthService.exchangeCodeForToken(code);

      console.log('✅ [Twitch OAuth Callback] Token exchange successful');

      // Calculate expiration date
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined;

      console.log('💾 [Twitch OAuth Callback] Preparing to save connected account...');
      console.log('📝 [Twitch OAuth Callback] Account data:', {
        platform: 'TWITCH',
        externalChannelId: userInfo.id,
        displayName: userInfo.display_name || userInfo.login,
        hasAccessToken: !!tokenResponse.access_token,
        hasRefreshToken: !!tokenResponse.refresh_token,
        scopes: tokenResponse.scope,
        expiresAt: expiresAt?.toISOString(),
      });

      // Create or update connected account
      const createDto: CreateConnectedAccountDto = {
        platform: 'TWITCH' as ConnectedPlatform,
        externalChannelId: userInfo.id,
        displayName: userInfo.display_name || userInfo.login,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        scopes: Array.isArray(tokenResponse.scope) ? tokenResponse.scope.join(' ') : tokenResponse.scope,
        expiresAt: expiresAt?.toISOString(),
      };

      const savedAccount = await this.connectedAccountsService.createOrUpdate(userId, createDto);
      console.log('✅ [Twitch OAuth Callback] Account saved successfully:', {
        id: savedAccount.id,
        platform: savedAccount.platform,
        displayName: savedAccount.displayName,
      });

      // Automatically subscribe to EventSub webhook events after successful OAuth
      try {
        console.log('🔔 [Twitch OAuth Callback] Subscribing to EventSub webhook events...');
        const broadcasterUserId = userInfo.id;
        const botUserId = broadcasterUserId; // Use broadcaster as bot by default
        
        // Check if account has required scopes
        const requiredScopes = ['user:read:chat', 'user:bot', 'channel:bot'];
        // tokenResponse.scope is always an array from Twitch API
        const accountScopes = tokenResponse.scope;
        const missingScopes = requiredScopes.filter(scope => !accountScopes.includes(scope));
        
        if (missingScopes.length > 0) {
          console.warn('⚠️ [Twitch OAuth Callback] Missing required scopes for webhook subscription:', missingScopes);
          console.warn('⚠️ [Twitch OAuth Callback] Webhook subscription skipped. User can subscribe manually later.');
        } else {
          // Use TWITCH_WEBHOOK_URL if configured, otherwise fallback to BACKEND_URL or localhost
          const webhookBaseUrl = 
            this.configService.get<string>('TWITCH_WEBHOOK_URL') ||
            this.configService.get<string>('BACKEND_URL') ||
            'http://localhost:4000';
          const webhookUrl = `${webhookBaseUrl.replace(/\/$/, '')}/api/webhooks/twitch`;
          const webhookSecret = this.configService.get<string>('TWITCH_WEBHOOK_SECRET');

          if (webhookSecret) {
            await this.twitchOAuthService.subscribeToChatMessages(
              broadcasterUserId,
              botUserId,
              webhookUrl,
              webhookSecret,
            );
            console.log('✅ [Twitch OAuth Callback] Successfully subscribed to EventSub webhook events');
          } else {
            console.warn('⚠️ [Twitch OAuth Callback] TWITCH_WEBHOOK_SECRET not configured. Webhook subscription skipped.');
            console.warn('⚠️ [Twitch OAuth Callback] User can subscribe manually later via /connected-accounts/twitch/subscribe-webhooks');
          }
        }
      } catch (webhookError) {
        // Log error but don't fail the OAuth flow
        console.error('⚠️ [Twitch OAuth Callback] Failed to subscribe to webhooks:', webhookError);
        console.error('⚠️ [Twitch OAuth Callback] Webhook subscription can be done manually later');
      }

      // Redirect to frontend with success
      console.log('🔄 [Twitch OAuth Callback] Redirecting to frontend...');
      res.redirect(`${frontendUrl}/settings?success=twitch_connected`);
    } catch (error: unknown) {
      console.error('Twitch OAuth callback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(
        `${frontendUrl}/settings?error=twitch_oauth_callback_failed&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  @Post('twitch/subscribe-webhooks')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-twitch')
  @ApiOperation({
    summary: 'Subscribe to Twitch EventSub webhook events',
    description: 'Creates EventSub subscription for channel.chat.message. Requires TWITCH_WEBHOOK_SECRET to be configured.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully subscribed to webhook events',
  })
  async subscribeToTwitchWebhooks(
    @CurrentUser() user: User,
    @Body() body: { update?: boolean; botUserId?: string },
  ): Promise<any> {
    try {
      // Find Twitch connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const twitchAccount = accounts.find((acc) => acc.platform === 'TWITCH');

      if (!twitchAccount) {
        throw new BadRequestException('No Twitch account connected');
      }

      const broadcasterUserId = twitchAccount.externalChannelId;
      const botUserId = body.botUserId || broadcasterUserId; // Use broadcaster as bot if not specified
      
      // Check if account has required scopes
      const requiredScopes = ['user:read:chat', 'user:bot', 'channel:bot'];
      const accountScopes = twitchAccount.scopes?.split(' ') || [];
      const missingScopes = requiredScopes.filter(scope => !accountScopes.includes(scope));
      
      if (missingScopes.length > 0) {
        throw new BadRequestException(
          `Missing required scopes: ${missingScopes.join(', ')}. ` +
          `Please reconnect your Twitch account with the required permissions. ` +
          `Required scopes: ${requiredScopes.join(', ')}`
        );
      }
      
      // Use TWITCH_WEBHOOK_URL if configured, otherwise fallback to BACKEND_URL or localhost
      const webhookBaseUrl = 
        this.configService.get<string>('TWITCH_WEBHOOK_URL') ||
        this.configService.get<string>('BACKEND_URL') ||
        'http://localhost:3000';
      // Remove trailing slash if present and add webhook path
      const webhookUrl = `${webhookBaseUrl.replace(/\/$/, '')}/api/webhooks/twitch`;
      const webhookSecret = this.configService.get<string>('TWITCH_WEBHOOK_SECRET');

      if (!webhookSecret) {
        throw new BadRequestException(
          'TWITCH_WEBHOOK_SECRET not configured. Please set this environment variable with your webhook secret.',
        );
      }

      let result;
      if (body.update) {
        // Update: delete old subscriptions and create new ones
        result = await this.twitchOAuthService.updateEventSubSubscriptions(
          broadcasterUserId,
          botUserId,
          webhookUrl,
          webhookSecret,
        );
      } else {
        // Just create new subscription
        result = await this.twitchOAuthService.subscribeToChatMessages(
          broadcasterUserId,
          botUserId,
          webhookUrl,
          webhookSecret,
        );
      }

      return {
        success: true,
        message: 'Successfully subscribed to EventSub webhook events',
        data: result,
        webhookUrl,
        note: 'Make sure TWITCH_WEBHOOK_SECRET environment variable matches the secret used when creating the subscription.',
      };
    } catch (error: unknown) {
      console.error('Error subscribing to Twitch webhooks:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to subscribe to webhooks: ${errorMessage}`);
    }
  }

  @Get('twitch/webhook-subscriptions')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-twitch')
  @ApiOperation({
    summary: 'Get active Twitch EventSub webhook subscriptions',
    description: 'Returns all active EventSub subscriptions',
  })
  @ApiResponse({
    status: 200,
    description: 'Active subscriptions retrieved successfully',
  })
  async getTwitchWebhookSubscriptions(@CurrentUser() user: User): Promise<any> {
    try {
      const appAccessToken = await this.twitchOAuthService.getAppAccessToken();
      const subscriptions = await this.twitchOAuthService.getEventSubSubscriptions(appAccessToken);
      const subscriptionsData = subscriptions.data || subscriptions;

      console.log('📋 [Twitch EventSub] Active subscriptions:', JSON.stringify(subscriptionsData, null, 2));

      // Use TWITCH_WEBHOOK_URL if configured, otherwise fallback to BACKEND_URL or localhost
      const webhookBaseUrl = 
        this.configService.get<string>('TWITCH_WEBHOOK_URL') ||
        this.configService.get<string>('BACKEND_URL') ||
        'http://localhost:4000';
      // Remove trailing slash if present and add webhook path
      const webhookUrl = `${webhookBaseUrl.replace(/\/$/, '')}/api/webhooks/twitch`;

      return {
        success: true,
        count: Array.isArray(subscriptionsData) ? subscriptionsData.length : 0,
        subscriptions: subscriptionsData,
        webhookUrl,
        total: subscriptions.total || 0,
        total_cost: subscriptions.total_cost || 0,
        max_total_cost: subscriptions.max_total_cost || 0,
      };
    } catch (error: unknown) {
      console.error('Error fetching Twitch webhook subscriptions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to fetch subscriptions: ${errorMessage}`);
    }
  }

  @Get('oauth/youtube/authorize')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-youtube')
  @ApiOperation({
    summary: 'Initiate YouTube OAuth flow',
    description: 'Returns YouTube authorization URL or redirects to YouTube authorization page',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to YouTube authorization page (when accessed via browser)',
  })
  async initiateYouTubeOAuth(
    @CurrentUser() user: User,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    try {
      // Generate state with user ID to ensure security
      const state = crypto.randomBytes(16).toString('hex');
      const stateWithUserId = `${state}:${user.id}`;

      // Store state for validation in callback
      this.youtubeOAuthService.storeState(stateWithUserId, user.id);

      const url = this.youtubeOAuthService.getAuthorizationUrl(stateWithUserId);

      // Check if request is from AJAX/fetch (has Accept: application/json header)
      const acceptHeader = req.headers.accept || '';
      const isJsonRequest = acceptHeader.includes('application/json');

      if (isJsonRequest) {
        // Return JSON for AJAX requests
        res.json({ url });
      } else {
        // Redirect for direct browser access
        res.redirect(url);
      }
    } catch (error) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const acceptHeader = req.headers.accept || '';
      const isJsonRequest = acceptHeader.includes('application/json');

      if (isJsonRequest) {
        res.status(500).json({
          error: 'youtube_oauth_not_configured',
          message: 'YouTube OAuth not configured',
        });
      } else {
        res.redirect(`${frontendUrl}/settings?error=youtube_oauth_not_configured`);
      }
    }
  }

  @Public()
  @Get('oauth/youtube/callback')
  @ApiTags('connected-accounts-youtube')
  @ApiOperation({
    summary: 'YouTube OAuth callback',
    description: 'Handles the callback from YouTube OAuth flow',
  })
  @ApiQuery({ name: 'code', required: false, description: 'Authorization code from YouTube' })
  @ApiQuery({ name: 'state', required: false, description: 'State parameter for security' })
  @ApiQuery({ name: 'error', required: false, description: 'Error from YouTube OAuth' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to frontend with success or error',
  })
  async youtubeOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    console.log('🎯 [YouTube OAuth Callback] Received callback');
    console.log('📝 [YouTube OAuth Callback] Query params:', { code: code?.substring(0, 20) + '...', state, error });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    if (error) {
      console.error('❌ [YouTube OAuth Callback] Error from YouTube:', error);
      res.redirect(`${frontendUrl}/settings?error=youtube_oauth_error&message=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      console.error('❌ [YouTube OAuth Callback] Missing code or state');
      res.redirect(`${frontendUrl}/settings?error=youtube_oauth_missing_params`);
      return;
    }

    try {
      // Decode URL-encoded state
      const decodedState = decodeURIComponent(state);
      console.log('📝 [YouTube OAuth Callback] Decoded state:', decodedState.substring(0, 50) + '...');

      // Validate state and extract userId
      const userId = this.youtubeOAuthService.validateState(decodedState);
      console.log('📝 [YouTube OAuth Callback] Extracted userId:', userId);

      console.log('🔄 [YouTube OAuth Callback] Starting token exchange...');
      // Exchange code for token
      const { tokenResponse, channelInfo } = await this.youtubeOAuthService.exchangeCodeForToken(code);

      console.log('✅ [YouTube OAuth Callback] Token exchange successful');

      // Calculate expiration date
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined;

      console.log('💾 [YouTube OAuth Callback] Preparing to save connected account...');
      console.log('📝 [YouTube OAuth Callback] Account data:', {
        platform: 'YOUTUBE',
        externalChannelId: channelInfo.id,
        displayName: channelInfo.title,
        hasAccessToken: !!tokenResponse.access_token,
        hasRefreshToken: !!tokenResponse.refresh_token,
        scopes: tokenResponse.scope,
        expiresAt: expiresAt?.toISOString(),
      });

      // Create or update connected account
      const createDto: CreateConnectedAccountDto = {
        platform: 'YOUTUBE' as ConnectedPlatform,
        externalChannelId: channelInfo.id,
        displayName: channelInfo.title,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        scopes: tokenResponse.scope,
        expiresAt: expiresAt?.toISOString(),
      };

      const savedAccount = await this.connectedAccountsService.createOrUpdate(userId, createDto);
      console.log('✅ [YouTube OAuth Callback] Account saved successfully:', {
        id: savedAccount.id,
        platform: savedAccount.platform,
        displayName: savedAccount.displayName,
      });

      // Redirect to frontend with success
      console.log('🔄 [YouTube OAuth Callback] Redirecting to frontend...');
      res.redirect(`${frontendUrl}/settings?success=youtube_connected`);
    } catch (error: unknown) {
      console.error('YouTube OAuth callback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(
        `${frontendUrl}/settings?error=youtube_oauth_callback_failed&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  @Post('youtube/start-chat-polling')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-youtube')
  @ApiOperation({
    summary: 'Start YouTube Live Chat polling',
    description: 'Starts polling chat messages from active YouTube live streams',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat polling started successfully',
  })
  async startYouTubeChatPolling(@CurrentUser() user: User): Promise<any> {
    try {
      // Find YouTube connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const youtubeAccount = accounts.find((acc) => acc.platform === 'YOUTUBE');

      if (!youtubeAccount) {
        throw new BadRequestException('No YouTube account connected');
      }

      if (!youtubeAccount.refreshToken) {
        throw new BadRequestException('YouTube account missing refresh token. Please reconnect your account.');
      }

      // Check if already polling
      if (this.youtubeChatService.isPollingActive(youtubeAccount.externalChannelId)) {
        return {
          success: true,
          message: 'Chat polling already active for this channel',
          channelId: youtubeAccount.externalChannelId,
        };
      }

      // Start polling
      await this.youtubeChatService.startChatPolling(
        youtubeAccount.externalChannelId,
        youtubeAccount.accessToken,
        youtubeAccount.refreshToken,
      );

      return {
        success: true,
        message: 'Chat polling started successfully',
        channelId: youtubeAccount.externalChannelId,
        note: 'Polling will automatically detect when a live stream starts and begin collecting chat messages.',
      };
    } catch (error: unknown) {
      console.error('Error starting YouTube chat polling:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to start chat polling: ${errorMessage}`);
    }
  }

  @Post('youtube/stop-chat-polling')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-youtube')
  @ApiOperation({
    summary: 'Stop YouTube Live Chat polling',
    description: 'Stops polling chat messages from YouTube live streams',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat polling stopped successfully',
  })
  async stopYouTubeChatPolling(@CurrentUser() user: User): Promise<any> {
    try {
      // Find YouTube connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const youtubeAccount = accounts.find((acc) => acc.platform === 'YOUTUBE');

      if (!youtubeAccount) {
        throw new BadRequestException('No YouTube account connected');
      }

      // Stop polling
      this.youtubeChatService.stopChatPolling(youtubeAccount.externalChannelId);

      return {
        success: true,
        message: 'Chat polling stopped successfully',
        channelId: youtubeAccount.externalChannelId,
      };
    } catch (error: unknown) {
      console.error('Error stopping YouTube chat polling:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to stop chat polling: ${errorMessage}`);
    }
  }

  @Get('youtube/polling-status')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-youtube')
  @ApiOperation({
    summary: 'Get YouTube Live Chat polling status',
    description: 'Checks if YouTube chat polling is currently active',
  })
  @ApiResponse({
    status: 200,
    description: 'Polling status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean' },
        channelId: { type: 'string', nullable: true },
      },
    },
  })
  async getYouTubePollingStatus(@CurrentUser() user: User): Promise<any> {
    try {
      // Find YouTube connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const youtubeAccount = accounts.find((acc) => acc.platform === 'YOUTUBE');

      if (!youtubeAccount) {
        return {
          isActive: false,
          channelId: null,
        };
      }

      // Check if polling is active
      const isActive = this.youtubeChatService.isPollingActive(youtubeAccount.externalChannelId);

      return {
        isActive,
        channelId: youtubeAccount.externalChannelId,
      };
    } catch (error: unknown) {
      console.error('Error checking YouTube polling status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to check polling status: ${errorMessage}`);
    }
  }

  @Post('twitch/refresh-token')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-twitch')
  @ApiOperation({
    summary: 'Refresh Twitch access token',
    description: 'Refreshes the Twitch access token using the stored refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        accessToken: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no account connected or missing refresh token',
  })
  async refreshTwitchToken(@CurrentUser() user: User): Promise<any> {
    try {
      // Find Twitch connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const twitchAccount = accounts.find((acc) => acc.platform === 'TWITCH');

      if (!twitchAccount) {
        throw new BadRequestException('No Twitch account connected');
      }

      if (!twitchAccount.refreshToken) {
        throw new BadRequestException('Twitch account missing refresh token. Please reconnect your account.');
      }

      // Refresh the token
      const tokenResponse = await this.twitchOAuthService.refreshAccessToken(twitchAccount.refreshToken);

      // Calculate expiration date
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined;

      // Update the account with new tokens
      const createDto: CreateConnectedAccountDto = {
        platform: 'TWITCH' as ConnectedPlatform,
        externalChannelId: twitchAccount.externalChannelId,
        displayName: twitchAccount.displayName,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token ?? twitchAccount.refreshToken ?? undefined, // Use new refresh token if provided, otherwise keep old one
        scopes: Array.isArray(tokenResponse.scope) ? tokenResponse.scope.join(' ') : twitchAccount.scopes ?? undefined,
        expiresAt: expiresAt?.toISOString(),
      };

      await this.connectedAccountsService.createOrUpdate(user.id, createDto);

      return {
        success: true,
        message: 'Twitch token refreshed successfully',
        accessToken: tokenResponse.access_token,
        expiresAt: expiresAt?.toISOString(),
      };
    } catch (error: unknown) {
      console.error('Error refreshing Twitch token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to refresh token: ${errorMessage}`);
    }
  }

  @Post('kick/refresh-token')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-kick')
  @ApiOperation({
    summary: 'Refresh Kick access token',
    description: 'Refreshes the Kick access token using the stored refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        accessToken: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no account connected or missing refresh token',
  })
  async refreshKickToken(@CurrentUser() user: User): Promise<any> {
    try {
      // Find Kick connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const kickAccount = accounts.find((acc) => acc.platform === 'KICK');

      if (!kickAccount) {
        throw new BadRequestException('No Kick account connected');
      }

      if (!kickAccount.refreshToken) {
        throw new BadRequestException('Kick account missing refresh token. Please reconnect your account.');
      }

      // Refresh the token
      const tokenResponse = await this.kickOAuthService.refreshAccessToken(kickAccount.refreshToken);

      // Calculate expiration date
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined;

      // Update the account with new tokens
      const createDto: CreateConnectedAccountDto = {
        platform: 'KICK' as ConnectedPlatform,
        externalChannelId: kickAccount.externalChannelId,
        displayName: kickAccount.displayName,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token ?? kickAccount.refreshToken ?? undefined, // Use new refresh token if provided, otherwise keep old one
        scopes: tokenResponse.scope ?? kickAccount.scopes ?? undefined,
        expiresAt: expiresAt?.toISOString(),
      };

      await this.connectedAccountsService.createOrUpdate(user.id, createDto);

      return {
        success: true,
        message: 'Kick token refreshed successfully',
        accessToken: tokenResponse.access_token,
        expiresAt: expiresAt?.toISOString(),
      };
    } catch (error: unknown) {
      console.error('Error refreshing Kick token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to refresh token: ${errorMessage}`);
    }
  }

  @Post('youtube/refresh-token')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('connected-accounts-youtube')
  @ApiOperation({
    summary: 'Refresh YouTube access token',
    description: 'Refreshes the YouTube access token using the stored refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        accessToken: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no account connected or missing refresh token',
  })
  async refreshYouTubeToken(@CurrentUser() user: User): Promise<any> {
    try {
      // Find YouTube connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const youtubeAccount = accounts.find((acc) => acc.platform === 'YOUTUBE');

      if (!youtubeAccount) {
        throw new BadRequestException('No YouTube account connected');
      }

      if (!youtubeAccount.refreshToken) {
        throw new BadRequestException('YouTube account missing refresh token. Please reconnect your account.');
      }

      // Refresh the token
      const tokenResponse = await this.youtubeOAuthService.refreshAccessToken(youtubeAccount.refreshToken);

      // Calculate expiration date
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined;

      // Update the account with new tokens
      const createDto: CreateConnectedAccountDto = {
        platform: 'YOUTUBE' as ConnectedPlatform,
        externalChannelId: youtubeAccount.externalChannelId,
        displayName: youtubeAccount.displayName,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token ?? youtubeAccount.refreshToken ?? undefined, // Use new refresh token if provided, otherwise keep old one
        scopes: tokenResponse.scope ?? youtubeAccount.scopes ?? undefined,
        expiresAt: expiresAt?.toISOString(),
      };

      await this.connectedAccountsService.createOrUpdate(user.id, createDto);

      return {
        success: true,
        message: 'YouTube token refreshed successfully',
        accessToken: tokenResponse.access_token,
        expiresAt: expiresAt?.toISOString(),
      };
    } catch (error: unknown) {
      console.error('Error refreshing YouTube token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to refresh token: ${errorMessage}`);
    }
  }
}

