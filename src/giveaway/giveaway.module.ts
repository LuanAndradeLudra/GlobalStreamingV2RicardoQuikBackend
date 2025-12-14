import { Module } from '@nestjs/common';
import { GiveawayService } from './giveaway.service';
import { GiveawayController } from './giveaway.controller';
import { StreamGiveawayRedisModule } from '../stream-giveaway-redis/stream-giveaway-redis.module';
import { RealtimeGatewayModule } from '../realtime-gateway/realtime-gateway.module';

// GiveawayModule encapsulates the core of giveaways, winner selection, and metrics.
@Module({
  imports: [StreamGiveawayRedisModule, RealtimeGatewayModule],
  controllers: [GiveawayController],
  providers: [GiveawayService],
  exports: [GiveawayService],
})
export class GiveawayModule {}
