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
        externalChannelId: channelInfo.id.toString(),
        displayName: channelInfo.display_name || channelInfo.username,
        hasAccessToken: !!tokenResponse.access_token,
        hasRefreshToken: !!tokenResponse.refresh_token,
        scopes: tokenResponse.scope,
        expiresAt: expiresAt?.toISOString(),
      });

      // Create or update connected account
      const createDto: CreateConnectedAccountDto = {
        platform: 'KICK' as ConnectedPlatform,
        externalChannelId: channelInfo.id.toString(),
        displayName: channelInfo.display_name || channelInfo.username,
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

  @Post('kick/send-chat-message')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send a chat message to Kick channel',
    description: 'Sends a chat message to the connected Kick channel. Requires chat:write scope. See https://docs.kick.com/apis/chat',
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid message or missing channel',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token or missing chat:write scope',
  })
  async sendKickChatMessage(
    @CurrentUser() user: User,
    @Body() body: { 
      message: string; 
      channelId?: number;
      type?: 'user' | 'bot';
      replyToMessageId?: string;
    },
  ): Promise<any> {
    try {
      // Find Kick connected account
      const accounts = await this.connectedAccountsService.findAll(user.id);
      const kickAccount = accounts.find((acc) => acc.platform === 'KICK');

      if (!kickAccount) {
        throw new BadRequestException('No Kick account connected');
      }

      // Check if chat:write scope is present
      const scopes = kickAccount.scopes?.split(' ') || [];
      if (!scopes.includes('chat:write')) {
        throw new BadRequestException('Missing chat:write scope. Please reconnect your Kick account with chat:write permission.');
      }

      const broadcasterUserId = body.channelId || parseInt(kickAccount.externalChannelId);
      const message = body.message?.trim();
      const type = (body.type as 'user' | 'bot') || 'user';
      const replyToMessageId = body.replyToMessageId;

      if (!message || message.length === 0) {
        throw new BadRequestException('Message cannot be empty');
      }

      if (message.length > 500) {
        throw new BadRequestException('Message cannot exceed 500 characters');
      }

      if (type !== 'user' && type !== 'bot') {
        throw new BadRequestException('Type must be either "user" or "bot"');
      }

      console.log('💬 [Kick Chat] Sending message to channel:', broadcasterUserId);
      console.log('💬 [Kick Chat] Message:', message);
      console.log('💬 [Kick Chat] Type:', type);

      const result = await this.kickOAuthService.sendChatMessage(
        kickAccount.accessToken,
        broadcasterUserId,
        message,
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

  @Post('kick/subscribe-webhooks')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
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
}

