import { Module } from '@nestjs/common';
import { TwitchBitsGiveawayService } from './twitch-bits-giveaway.service';
import { TwitchBitsGiveawayController } from './twitch-bits-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TwitchModule } from '../twitch/twitch.module';

@Module({
  imports: [PrismaModule, TwitchModule],
  controllers: [TwitchBitsGiveawayController],
  providers: [TwitchBitsGiveawayService],
  exports: [TwitchBitsGiveawayService],
})
export class TwitchBitsGiveawayModule {}






