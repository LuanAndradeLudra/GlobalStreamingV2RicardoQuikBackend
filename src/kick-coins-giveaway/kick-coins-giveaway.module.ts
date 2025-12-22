import { Module } from '@nestjs/common';
import { KickCoinsGiveawayService } from './kick-coins-giveaway.service';
import { KickCoinsGiveawayController } from './kick-coins-giveaway.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { KickModule } from '../kick/kick.module';

@Module({
  imports: [PrismaModule, KickModule],
  controllers: [KickCoinsGiveawayController],
  providers: [KickCoinsGiveawayService],
  exports: [KickCoinsGiveawayService],
})
export class KickCoinsGiveawayModule {}










