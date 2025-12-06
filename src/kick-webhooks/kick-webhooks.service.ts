import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class KickWebhooksService {
  private readonly logger = new Logger(KickWebhooksService.name);
  private readonly kickPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

  /**
   * Parse and validate the RSA public key
   */
  private getPublicKey(): crypto.KeyObject {
    try {
      return crypto.createPublicKey({
        key: this.kickPublicKey,
        format: 'pem',
      });
    } catch (error) {
      this.logger.error('Failed to parse Kick public key:', error);
      throw new Error('Invalid public key configuration');
    }
  }

  /**
   * Verify webhook signature according to Kick's documentation
   * 
   * According to https://docs.kick.com/events/webhook-security:
   * - Signature is created by concatenating: messageId.timestamp.rawBody
   * - Then signed with RSA-SHA256 (PKCS#1 v1.5)
   * - The signature in header is base64 encoded
   * 
   * IMPORTANT: The rawBody must be exactly as received, without any modifications
   */
  verifySignature(
    messageId: string,
    timestamp: string,
    rawBody: string | Buffer,
    signatureB64: string,
  ): boolean {
    try {
      // Convert rawBody to Buffer if it's a string
      const rawBodyBuffer = typeof rawBody === 'string' 
        ? Buffer.from(rawBody, 'utf8') 
        : rawBody;

      // Concat EXACTLY: messageId.timestamp.rawBody (as Buffer, then convert to string)
      // This matches the exact format Kick uses
      const data = Buffer.from(`${messageId}.${timestamp}.${rawBodyBuffer.toString('utf8')}`, 'utf8');

      // Decode base64 signature
      const signature = Buffer.from(signatureB64, 'base64');

      // Get public key
      const publicKey = this.getPublicKey();

      // Verify signature using RSA-SHA256 (PKCS#1 v1.5)
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(data);
      verifier.end();

      const isValid = verifier.verify(publicKey, signature);

      if (!isValid) {
        this.logger.error('❌ [Signature] Verification failed');
        this.logger.error('❌ [Signature] Message ID:', messageId);
        this.logger.error('❌ [Signature] Timestamp:', timestamp);
        this.logger.error('❌ [Signature] Raw body length:', rawBodyBuffer.length);
        this.logger.error('❌ [Signature] Raw body preview:', rawBodyBuffer.toString('utf8').substring(0, 100));
      }

      return isValid;
    } catch (error) {
      this.logger.error('❌ [Signature] Verification error:', error);
      this.logger.error('❌ [Signature] Error details:', error instanceof Error ? error.stack : String(error));
      return false;
    }
  }

  /**
   * Process chat message event
   */
  async processChatMessage(event: any): Promise<void> {
    this.logger.log('📨 [Kick Webhook] Chat message received');
    this.logger.log('📝 [Kick Webhook] Message details:', JSON.stringify(event, null, 2));
    
    // Log message content
    if (event.content) {
      this.logger.log(`💬 [Kick Webhook] Message: "${event.content}"`);
    }
    
    if (event.sender) {
      this.logger.log(`👤 [Kick Webhook] From: ${event.sender.username || event.sender.slug} (ID: ${event.sender.id})`);
    }
    
    if (event.broadcaster_user_id) {
      this.logger.log(`📺 [Kick Webhook] Channel ID: ${event.broadcaster_user_id}`);
    }
  }

  /**
   * Process subscription event
   */
  async processSubscription(event: any): Promise<void> {
    this.logger.log('🎁 [Kick Webhook] Subscription event received');
    this.logger.log('📝 [Kick Webhook] Subscription details:', JSON.stringify(event, null, 2));
  }

  /**
   * Process kicks gifted event
   */
  async processKicksGifted(event: any): Promise<void> {
    this.logger.log('💰 [Kick Webhook] Kicks gifted event received');
    this.logger.log('📝 [Kick Webhook] Kicks details:', JSON.stringify(event, null, 2));
  }
}

