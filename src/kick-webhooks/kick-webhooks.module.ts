import { Module } from '@nestjs/common';
import { KickWebhooksController } from './kick-webhooks.controller';
import { KickWebhooksService } from './kick-webhooks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StreamGiveawayRedisModule } from '../stream-giveaway-redis/stream-giveaway-redis.module';
import { RealtimeGatewayModule } from '../realtime-gateway/realtime-gateway.module';
import { GiveawayModule } from '../giveaway/giveaway.module';
import { KickModule } from '../kick/kick.module';

@Module({
  imports: [
    PrismaModule,
    StreamGiveawayRedisModule,
    RealtimeGatewayModule,
    GiveawayModule,
    KickModule,
  ],
  controllers: [KickWebhooksController],
  providers: [KickWebhooksService],
  exports: [KickWebhooksService],
})
export class KickWebhooksModule {}



