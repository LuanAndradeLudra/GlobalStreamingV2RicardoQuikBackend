import {
  Controller,
  Get,
  Post,
  Headers,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { TwitchWebhooksService } from './twitch-webhooks.service';

@ApiTags('twitch-webhooks')
@Controller('webhooks/twitch')
export class TwitchWebhooksController {
  private readonly logger = new Logger(TwitchWebhooksController.name);

  constructor(private readonly twitchWebhooksService: TwitchWebhooksService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Twitch webhook endpoint (GET)',
    description: 'GET endpoint for webhook verification or health check',
  })
  async webhookGet(@Req() req: Request): Promise<{ status: string; message: string }> {
    return { status: 'ok', message: 'Webhook endpoint is accessible' };
  }

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Twitch webhook endpoint',
    description: 'Receives EventSub webhook events from Twitch platform',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or missing headers',
  })
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Body() body: any,
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
  ): Promise<void> {
    // Extract headers (NestJS converts headers to lowercase)
    // Twitch EventSub uses these headers:
    // - Twitch-Eventsub-Message-Id
    // - Twitch-Eventsub-Message-Timestamp
    // - Twitch-Eventsub-Message-Signature
    // - Twitch-Eventsub-Message-Type
    // - Twitch-Eventsub-Subscription-Type (only for notification and revocation)
    // - Twitch-Eventsub-Subscription-Version (only for notification and revocation)
    const messageId = headers['twitch-eventsub-message-id'];
    const timestamp = headers['twitch-eventsub-message-timestamp'];
    const signature = headers['twitch-eventsub-message-signature'];
    const messageType = headers['twitch-eventsub-message-type'];
    const subscriptionType = headers['twitch-eventsub-subscription-type'];
    const subscriptionVersion = headers['twitch-eventsub-subscription-version'];

    // Check if this is a Twitch webhook request (has Twitch-Eventsub-Message-Type header)
    const isTwitchWebhook = !!messageType || !!headers['twitch-eventsub-message-type'];

    if (!isTwitchWebhook) {
      res.status(HttpStatus.OK).json({
        status: 'ok',
        message: 'Webhook endpoint is accessible. This endpoint expects Twitch EventSub webhook events.',
      });
      return;
    }

    // Validate required headers
    if (!messageId || !timestamp || !signature || !messageType) {
      this.logger.error('❌ [Twitch Webhook] Missing required headers');
      throw new BadRequestException('Missing required webhook headers');
    }

    // Get raw body for signature verification
    // CRITICAL: Use rawBody Buffer exactly as received, without modifications
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(body), 'utf8');

    console.log('🔄 [Twitch Webhook] Raw body:', rawBody.toString('utf8'));

    // Verify signature (skip for webhook_callback_verification message type)
    if (messageType !== 'webhook_callback_verification') {
      const isValid = this.twitchWebhooksService.verifySignature(
        messageId,
        timestamp,
        rawBody,
        signature,
      );

      if (!isValid) {
        this.logger.error('❌ [Twitch Webhook] Invalid signature');
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    // Parse JSON from raw body (after signature verification)
    let eventData: any;
    try {
      const rawBodyString = rawBody.toString('utf8');
      eventData = JSON.parse(rawBodyString);
    } catch (parseError) {
      this.logger.error('❌ [Twitch Webhook] Failed to parse JSON:', parseError);
      // Still return 200 to prevent webhook disabling
      res.status(HttpStatus.OK).json({ status: 'ok' });
      return;
    }

    // Handle different message types
    try {
      switch (messageType) {
        case 'webhook_callback_verification':
          // Twitch requires us to return the challenge string for verification
          const challenge = eventData.challenge;
          if (!challenge) {
            this.logger.error('❌ [Twitch Webhook] Missing challenge in verification request');
            throw new BadRequestException('Missing challenge');
          }
          // Return challenge as plain text (not JSON)
          res.status(HttpStatus.OK).contentType('text/plain').send(challenge);
          return;

        case 'notification':
          // Process notification events
          if (subscriptionType === 'channel.chat.message') {
            await this.twitchWebhooksService.processChatMessage(eventData.event);
          } else if (subscriptionType === 'channel.cheer') {
            await this.twitchWebhooksService.processBitsEvent(eventData.event);
          }
          break;

        case 'revocation':
          // Process revocation events
          await this.twitchWebhooksService.processRevocation(eventData);
          break;
      }

      // Return JSON response for all other message types
      res.status(HttpStatus.OK).json({ status: 'ok' });
      return;
    } catch (error) {
      this.logger.error('❌ [Twitch Webhook] Error processing event:', error);
      // Always return 200 to prevent Twitch from disabling webhooks
      // Except for verification challenges, which need to return the challenge string
      if (messageType === 'webhook_callback_verification') {
        throw error; // Re-throw to return proper error response
      }
      res.status(HttpStatus.OK).json({ status: 'ok' });
      return;
    }
  }
}

