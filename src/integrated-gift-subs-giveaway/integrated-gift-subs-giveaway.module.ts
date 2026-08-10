import { Module } from '@nestjs/common';
import { IntegratedGiftSubsGiveawayService } from './integrated-gift-subs-giveaway.service';
import { IntegratedGiftSubsGiveawayController } from './integrated-gift-subs-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TwitchModule } from '../twitch/twitch.module';
import { KickModule } from '../kick/kick.module';
import { MonthlyWinLimitModule } from '../monthly-win-limit/monthly-win-limit.module';

@Module({
  imports: [PrismaModule, TwitchModule, KickModule, MonthlyWinLimitModule],
  controllers: [IntegratedGiftSubsGiveawayController],
  providers: [IntegratedGiftSubsGiveawayService],
  exports: [IntegratedGiftSubsGiveawayService],
})
export class IntegratedGiftSubsGiveawayModule {}
