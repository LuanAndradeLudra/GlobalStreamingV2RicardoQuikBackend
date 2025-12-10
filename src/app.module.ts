import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConnectedAccountsModule } from './connected-accounts/connected-accounts.module';
import { TicketConfigModule } from './ticket-config/ticket-config.module';
import { GiveawayModule } from './giveaway/giveaway.module';
import { KickGiftSubsGiveawayModule } from './kick-gift-subs-giveaway/kick-gift-subs-giveaway.module';
import { RealtimeGatewayModule } from './realtime-gateway/realtime-gateway.module';
import { SocialGiveawayModule } from './social-giveaway/social-giveaway.module';
import { KickWebhooksModule } from './kick-webhooks/kick-webhooks.module';
import { KickModule } from './kick/kick.module';
import { TwitchWebhooksModule } from './twitch-webhooks/twitch-webhooks.module';
import { YouTubeChatModule } from './youtube-chat/youtube-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    ConnectedAccountsModule,
    TicketConfigModule,
    GiveawayModule,
    KickGiftSubsGiveawayModule,
    RealtimeGatewayModule,
    SocialGiveawayModule,
    KickWebhooksModule,
    KickModule,
    TwitchWebhooksModule,
    YouTubeChatModule,
  ],
})
export class AppModule {}
