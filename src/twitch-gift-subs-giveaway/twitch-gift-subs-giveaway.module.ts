import { Module } from '@nestjs/common';
import { TwitchGiftSubsGiveawayService } from './twitch-gift-subs-giveaway.service';
import { TwitchGiftSubsGiveawayController } from './twitch-gift-subs-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TwitchModule } from '../twitch/twitch.module';

@Module({
  imports: [PrismaModule, TwitchModule],
  controllers: [TwitchGiftSubsGiveawayController],
  providers: [TwitchGiftSubsGiveawayService],
  exports: [TwitchGiftSubsGiveawayService],
})
export class TwitchGiftSubsGiveawayModule {}





