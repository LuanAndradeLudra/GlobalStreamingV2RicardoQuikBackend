import { Module } from '@nestjs/common';
import { IntegratedGiftSubsGiveawayService } from './integrated-gift-subs-giveaway.service';
import { IntegratedGiftSubsGiveawayController } from './integrated-gift-subs-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TwitchGiftSubsGiveawayModule } from '../twitch-gift-subs-giveaway/twitch-gift-subs-giveaway.module';
import { KickGiftSubsGiveawayModule } from '../kick-gift-subs-giveaway/kick-gift-subs-giveaway.module';

@Module({
  imports: [PrismaModule, TwitchGiftSubsGiveawayModule, KickGiftSubsGiveawayModule],
  controllers: [IntegratedGiftSubsGiveawayController],
  providers: [IntegratedGiftSubsGiveawayService],
  exports: [IntegratedGiftSubsGiveawayService],
})
export class IntegratedGiftSubsGiveawayModule {}
