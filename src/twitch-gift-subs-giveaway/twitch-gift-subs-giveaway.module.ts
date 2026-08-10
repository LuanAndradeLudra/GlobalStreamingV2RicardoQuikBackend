import { Module } from '@nestjs/common';
import { TwitchGiftSubsGiveawayService } from './twitch-gift-subs-giveaway.service';
import { TwitchGiftSubsGiveawayController } from './twitch-gift-subs-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TwitchModule } from '../twitch/twitch.module';
import { MonthlyWinLimitModule } from '../monthly-win-limit/monthly-win-limit.module';

@Module({
  imports: [PrismaModule, TwitchModule, MonthlyWinLimitModule],
  controllers: [TwitchGiftSubsGiveawayController],
  providers: [TwitchGiftSubsGiveawayService],
  exports: [TwitchGiftSubsGiveawayService],
})
export class TwitchGiftSubsGiveawayModule {}
