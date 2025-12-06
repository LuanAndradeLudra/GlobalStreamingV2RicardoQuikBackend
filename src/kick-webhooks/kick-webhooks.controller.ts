import {
  Controller,
  Get,
  Post,
  Headers,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { KickWebhooksService } from './kick-webhooks.service';

@ApiTags('kick-webhooks')
@Controller('webhooks/kick')
export class KickWebhooksController {
  private readonly logger = new Logger(KickWebhooksController.name);

  constructor(private readonly kickWebhooksService: KickWebhooksService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kick webhook endpoint (GET)',
    description: 'GET endpoint for webhook verification or health check',
  })
  async webhookGet(@Req() req: Request): Promise<{ status: string; message: string }> {
    this.logger.log('🔔 [Kick Webhook GET] Health check');
    return { status: 'ok', message: 'Webhook endpoint is accessible' };
  }

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kick webhook endpoint',
    description: 'Receives webhook events from Kick platform',
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
  ): Promise<{ status: string }> {
    // Log ALL incoming requests - FIRST THING
    this.logger.log('🔔 [Kick Webhook] ====== WEBHOOK REQUEST RECEIVED ======');
    this.logger.log('🔔 [Kick Webhook] Timestamp:', new Date().toISOString());
    this.logger.log('🔔 [Kick Webhook] Method:', req.method);
    this.logger.log('🔔 [Kick Webhook] URL:', req.url);
    this.logger.log('🔔 [Kick Webhook] IP:', req.ip || req.socket?.remoteAddress);
    this.logger.log('🔔 [Kick Webhook] User-Agent:', req.headers['user-agent']);

    // Extract headers (NestJS converts headers to lowercase)
    const messageId = headers['kick-event-message-id'];
    const subscriptionId = headers['kick-event-subscription-id'];
    const signature = headers['kick-event-signature'];
    const timestamp = headers['kick-event-message-timestamp'];
    const eventType = headers['kick-event-type'];
    const eventVersion = headers['kick-event-version'];

    // Log all headers for debugging
    this.logger.log('🔔 [Kick Webhook] All headers:', JSON.stringify(headers, null, 2));

    // Check if this is a Kick webhook request (has Kick-Event-Type header)
    const isKickWebhook = !!eventType || !!headers['kick-event-type'];

    if (!isKickWebhook) {
      // This is not a Kick webhook request - probably a test/manual request
      this.logger.warn('⚠️ [Kick Webhook] Received non-Kick request (likely test/manual)');
      return {
        status: 'ok',
        message: 'Webhook endpoint is accessible. This endpoint expects Kick webhook events.',
      } as any;
    }

    // Validate required headers - based on kickcom.py library
    if (!messageId || !subscriptionId || !signature || !timestamp || !eventType || !eventVersion) {
      this.logger.error('❌ [Kick Webhook] Missing required headers');
      this.logger.error('❌ [Kick Webhook] Missing:', {
        messageId: !messageId,
        subscriptionId: !subscriptionId,
        signature: !signature,
        timestamp: !timestamp,
        eventType: !eventType,
        eventVersion: !eventVersion,
      });
      throw new BadRequestException('Missing required webhook headers');
    }

    // Get raw body for signature verification
    // CRITICAL: Use rawBody Buffer exactly as received, without modifications
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(body), 'utf8');
    
    this.logger.log('📝 [Kick Webhook] Raw body type:', typeof rawBody);
    this.logger.log('📝 [Kick Webhook] Raw body length:', rawBody.length);
    this.logger.log('📝 [Kick Webhook] Raw body preview:', rawBody.toString('utf8').substring(0, 200));

    // Verify signature
    // Pass rawBody as Buffer to maintain exact bytes
    const isValid = this.kickWebhooksService.verifySignature(
      messageId,
      timestamp,
      rawBody,
      signature,
    );

    if (!isValid) {
      this.logger.error('❌ [Kick Webhook] Invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log('✅ [Kick Webhook] Signature verified successfully');

    // Parse JSON from raw body (after signature verification)
    // According to docs: parse JSON only AFTER verifying signature
    let eventData: any;
    try {
      const rawBodyString = rawBody.toString('utf8');
      eventData = JSON.parse(rawBodyString);
    } catch (parseError) {
      this.logger.error('❌ [Kick Webhook] Failed to parse JSON:', parseError);
      // Still return 200 to prevent webhook disabling
      return { status: 'ok' };
    }

    const event = eventData.event || eventData;

    // Process event based on type
    try {

      this.logger.log('📦 [Kick Webhook] Event type:', eventType);
      this.logger.log('📦 [Kick Webhook] Event data:', JSON.stringify(event, null, 2));

      switch (eventType) {
        case 'chat.message.sent':
          await this.kickWebhooksService.processChatMessage(event);
          break;

        case 'channel.subscription.new':
          await this.kickWebhooksService.processSubscription(event);
          break;

        case 'kicks.gifted':
          await this.kickWebhooksService.processKicksGifted(event);
          break;

        default:
          this.logger.warn(`⚠️ [Kick Webhook] Unknown event type: ${eventType}`);
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('❌ [Kick Webhook] Error processing event:', error);
      // Always return 200 to prevent Kick from disabling webhooks
      return { status: 'ok' };
    }
  }
}

