import { Module } from '@nestjs/common';
import { TwitchBitsGiveawayService } from './twitch-bits-giveaway.service';
import { TwitchBitsGiveawayController } from './twitch-bits-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TwitchModule } from '../twitch/twitch.module';
import { MonthlyWinLimitModule } from '../monthly-win-limit/monthly-win-limit.module';

@Module({
  imports: [PrismaModule, TwitchModule, MonthlyWinLimitModule],
  controllers: [TwitchBitsGiveawayController],
  providers: [TwitchBitsGiveawayService],
  exports: [TwitchBitsGiveawayService],
})
export class TwitchBitsGiveawayModule {}












