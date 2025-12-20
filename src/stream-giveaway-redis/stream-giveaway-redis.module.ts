import { Module } from '@nestjs/common';
import { StreamGiveawayRedisService } from './stream-giveaway-redis.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [StreamGiveawayRedisService],
  exports: [StreamGiveawayRedisService],
})
export class StreamGiveawayRedisModule {}








