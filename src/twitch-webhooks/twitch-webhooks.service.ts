import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class TwitchWebhooksService {
  private readonly logger = new Logger(TwitchWebhooksService.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.get<string>('TWITCH_WEBHOOK_SECRET') || '';
    
    if (!this.webhookSecret) {
      this.logger.warn(
        '⚠️  Twitch webhook secret not configured. Set TWITCH_WEBHOOK_SECRET environment variable.',
      );
    }
  }

  /**
   * Verify webhook signature according to Twitch's documentation
   * 
   * According to https://dev.twitch.tv/docs/eventsub/handling-webhook-events/#verifying-the-event-message:
   * - Signature is HMAC-SHA256 hash of message_id + timestamp + rawBody
   * - The signature in header is prefixed with "sha256="
   * - The signature is hex encoded
   * 
   * IMPORTANT: The rawBody must be exactly as received, without any modifications
   */
  verifySignature(
    messageId: string,
    timestamp: string,
    rawBody: string | Buffer,
    signature: string,
  ): boolean {
    try {
      if (!this.webhookSecret) {
        this.logger.error('❌ [Twitch Webhook] Webhook secret not configured');
        return false;
      }

      // Convert rawBody to Buffer if it's a string
      const rawBodyBuffer = typeof rawBody === 'string' 
        ? Buffer.from(rawBody, 'utf8') 
        : rawBody;

      // Remove "sha256=" prefix if present
      const signatureWithoutPrefix = signature.replace(/^sha256=/, '');

      // Create HMAC-SHA256 hash: message_id + timestamp + rawBody
      const message = messageId + timestamp + rawBodyBuffer.toString('utf8');
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      hmac.update(message);
      const expectedSignature = hmac.digest('hex');

      // Convert signatures to buffers for comparison
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const receivedBuffer = Buffer.from(signatureWithoutPrefix, 'hex');

      // Buffers must be the same length for timingSafeEqual
      if (expectedBuffer.length !== receivedBuffer.length) {
        this.logger.error('❌ [Twitch Webhook] Signature length mismatch');
        return false;
      }

      // Compare signatures using constant-time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

      if (!isValid) {
        this.logger.error('❌ [Twitch Webhook] Signature verification failed');
        this.logger.error('❌ [Twitch Webhook] Message ID:', messageId);
        this.logger.error('❌ [Twitch Webhook] Timestamp:', timestamp);
        this.logger.error('❌ [Twitch Webhook] Raw body length:', rawBodyBuffer.length);
        this.logger.error('❌ [Twitch Webhook] Expected signature:', expectedSignature);
        this.logger.error('❌ [Twitch Webhook] Received signature:', signatureWithoutPrefix);
      }

      return isValid;
    } catch (error) {
      this.logger.error('❌ [Twitch Webhook] Signature verification error:', error);
      this.logger.error('❌ [Twitch Webhook] Error details:', error instanceof Error ? error.stack : String(error));
      return false;
    }
  }

  /**
   * Process chat message event from EventSub
   */
  async processChatMessage(event: any): Promise<void> {
    this.logger.log('📨 [Twitch Webhook] Chat message received');
    this.logger.log('📝 [Twitch Webhook] Message details:', JSON.stringify(event, null, 2));
    
    // Log message content
    if (event.message?.text) {
      this.logger.log(`💬 [Twitch Webhook] Message: "${event.message.text}"`);
    }
    
    if (event.chatter_user_name) {
      this.logger.log(`👤 [Twitch Webhook] From: ${event.chatter_user_name} (ID: ${event.chatter_user_id})`);
    }
    
    if (event.broadcaster_user_id) {
      this.logger.log(`📺 [Twitch Webhook] Channel ID: ${event.broadcaster_user_id}`);
    }

    // TODO: Process chat message for giveaway logic
    // This is where you would integrate with your giveaway system
  }

  /**
   * Process revocation event
   * This happens when a subscription is revoked (e.g., bot banned, timed out, etc.)
   */
  async processRevocation(event: any): Promise<void> {
    this.logger.warn('⚠️ [Twitch Webhook] Subscription revoked');
    this.logger.log('📝 [Twitch Webhook] Revocation details:', JSON.stringify(event, null, 2));
    
    if (event.subscription) {
      this.logger.log(`🔴 [Twitch Webhook] Subscription ID: ${event.subscription.id}`);
      this.logger.log(`🔴 [Twitch Webhook] Subscription Type: ${event.subscription.type}`);
      this.logger.log(`🔴 [Twitch Webhook] Status: ${event.subscription.status}`);
    }

    // TODO: Handle revocation - cleanup subscriptions, notify user, etc.
  }
}

