import { Module } from '@nestjs/common';
import { IntegratedBitsKickCoinsGiveawayService } from './integrated-bits-kick-coins-giveaway.service';
import { IntegratedBitsKickCoinsGiveawayController } from './integrated-bits-kick-coins-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TwitchModule } from '../twitch/twitch.module';
import { KickModule } from '../kick/kick.module';

@Module({
  imports: [PrismaModule, TwitchModule, KickModule],
  controllers: [IntegratedBitsKickCoinsGiveawayController],
  providers: [IntegratedBitsKickCoinsGiveawayService],
  exports: [IntegratedBitsKickCoinsGiveawayService],
})
export class IntegratedBitsKickCoinsGiveawayModule {}











