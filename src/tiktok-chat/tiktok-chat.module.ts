import { Module } from '@nestjs/common';
import { TikTokChatService } from './tiktok-chat.service';
import { GiveawayModule } from '../giveaway/giveaway.module';
import { StreamGiveawayRedisModule } from '../stream-giveaway-redis/stream-giveaway-redis.module';
import { RealtimeGatewayModule } from '../realtime-gateway/realtime-gateway.module';

@Module({
  imports: [GiveawayModule, StreamGiveawayRedisModule, RealtimeGatewayModule],
  providers: [TikTokChatService],
  exports: [TikTokChatService],
})
export class TikTokChatModule {}
