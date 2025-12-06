import { Module } from '@nestjs/common';
import { KickWebhooksController } from './kick-webhooks.controller';
import { KickWebhooksService } from './kick-webhooks.service';

@Module({
  controllers: [KickWebhooksController],
  providers: [KickWebhooksService],
  exports: [KickWebhooksService],
})
export class KickWebhooksModule {}



