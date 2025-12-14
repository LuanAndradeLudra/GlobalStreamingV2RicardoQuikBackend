import { Module } from '@nestjs/common';
import { TwitchWebhooksController } from './twitch-webhooks.controller';
import { TwitchWebhooksService } from './twitch-webhooks.service';
import { StreamGiveawayRedisModule } from '../stream-giveaway-redis/stream-giveaway-redis.module';
import { RealtimeGatewayModule } from '../realtime-gateway/realtime-gateway.module';
import { GiveawayModule } from '../giveaway/giveaway.module';
import { TwitchModule } from '../twitch/twitch.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    StreamGiveawayRedisModule,
    RealtimeGatewayModule,
    GiveawayModule,
    TwitchModule,
  ],
  controllers: [TwitchWebhooksController],
  providers: [TwitchWebhooksService],
  exports: [TwitchWebhooksService],
})
export class TwitchWebhooksModule {}










