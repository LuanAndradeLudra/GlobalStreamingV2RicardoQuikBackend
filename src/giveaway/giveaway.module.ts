import { Module } from '@nestjs/common';
import { GiveawayService } from './giveaway.service';
import { GiveawayController } from './giveaway.controller';

// GiveawayModule encapsulates the core of giveaways, winner selection, and metrics.
@Module({
  controllers: [GiveawayController],
  providers: [GiveawayService],
  exports: [GiveawayService],
})
export class GiveawayModule {}
