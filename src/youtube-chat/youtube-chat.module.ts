import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { YouTubeChatService } from './youtube-chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GiveawayModule } from '../giveaway/giveaway.module';
import { StreamGiveawayRedisModule } from '../stream-giveaway-redis/stream-giveaway-redis.module';
import { RealtimeGatewayModule } from '../realtime-gateway/realtime-gateway.module';

@Module({
  imports: [ConfigModule, PrismaModule, GiveawayModule, StreamGiveawayRedisModule, RealtimeGatewayModule],
  providers: [YouTubeChatService],
  exports: [YouTubeChatService],
})
export class YouTubeChatModule {}
















