import { Module } from '@nestjs/common';
import { KickGiftSubsGiveawayService } from './kick-gift-subs-giveaway.service';
import { KickGiftSubsGiveawayController } from './kick-gift-subs-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KickGiftSubsGiveawayController],
  providers: [KickGiftSubsGiveawayService],
  exports: [KickGiftSubsGiveawayService],
})
export class KickGiftSubsGiveawayModule {}
