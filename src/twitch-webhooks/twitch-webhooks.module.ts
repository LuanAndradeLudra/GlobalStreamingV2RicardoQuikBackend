import { Module } from '@nestjs/common';
import { TwitchWebhooksController } from './twitch-webhooks.controller';
import { TwitchWebhooksService } from './twitch-webhooks.service';

@Module({
  controllers: [TwitchWebhooksController],
  providers: [TwitchWebhooksService],
  exports: [TwitchWebhooksService],
})
export class TwitchWebhooksModule {}



