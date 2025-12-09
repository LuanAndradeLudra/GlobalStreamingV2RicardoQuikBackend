import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { YouTubeChatService } from './youtube-chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GiveawayModule } from '../giveaway/giveaway.module';

@Module({
  imports: [ConfigModule, PrismaModule, GiveawayModule],
  providers: [YouTubeChatService],
  exports: [YouTubeChatService],
})
export class YouTubeChatModule {}


