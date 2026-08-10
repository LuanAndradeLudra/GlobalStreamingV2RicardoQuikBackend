import { Module } from '@nestjs/common';
import { KickCoinsGiveawayService } from './kick-coins-giveaway.service';
import { KickCoinsGiveawayController } from './kick-coins-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { KickModule } from '../kick/kick.module';
import { MonthlyWinLimitModule } from '../monthly-win-limit/monthly-win-limit.module';

@Module({
  imports: [PrismaModule, KickModule, MonthlyWinLimitModule],
  controllers: [KickCoinsGiveawayController],
  providers: [KickCoinsGiveawayService],
  exports: [KickCoinsGiveawayService],
})
export class KickCoinsGiveawayModule {}
