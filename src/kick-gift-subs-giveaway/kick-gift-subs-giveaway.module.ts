import { Module } from '@nestjs/common';
import { KickGiftSubsGiveawayService } from './kick-gift-subs-giveaway.service';
import { KickGiftSubsGiveawayController } from './kick-gift-subs-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { KickModule } from '../kick/kick.module';
import { MonthlyWinLimitModule } from '../monthly-win-limit/monthly-win-limit.module';

@Module({
  imports: [PrismaModule, KickModule, MonthlyWinLimitModule],
  controllers: [KickGiftSubsGiveawayController],
  providers: [KickGiftSubsGiveawayService],
  exports: [KickGiftSubsGiveawayService],
})
export class KickGiftSubsGiveawayModule {}
