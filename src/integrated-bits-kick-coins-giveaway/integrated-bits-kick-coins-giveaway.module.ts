import { Module } from '@nestjs/common';
import { IntegratedBitsKickCoinsGiveawayService } from './integrated-bits-kick-coins-giveaway.service';
import { IntegratedBitsKickCoinsGiveawayController } from './integrated-bits-kick-coins-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TwitchModule } from '../twitch/twitch.module';
import { KickModule } from '../kick/kick.module';
import { MonthlyWinLimitModule } from '../monthly-win-limit/monthly-win-limit.module';

@Module({
  imports: [PrismaModule, TwitchModule, KickModule, MonthlyWinLimitModule],
  controllers: [IntegratedBitsKickCoinsGiveawayController],
  providers: [IntegratedBitsKickCoinsGiveawayService],
  exports: [IntegratedBitsKickCoinsGiveawayService],
})
export class IntegratedBitsKickCoinsGiveawayModule {}
