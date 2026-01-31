import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StreamGiveawayRedisModule } from './stream-giveaway-redis/stream-giveaway-redis.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConnectedAccountsModule } from './connected-accounts/connected-accounts.module';
import { TicketConfigModule } from './ticket-config/ticket-config.module';
import { GiveawayModule } from './giveaway/giveaway.module';
import { KickGiftSubsGiveawayModule } from './kick-gift-subs-giveaway/kick-gift-subs-giveaway.module';
import { KickCoinsGiveawayModule } from './kick-coins-giveaway/kick-coins-giveaway.module';
import { TwitchBitsGiveawayModule } from './twitch-bits-giveaway/twitch-bits-giveaway.module';
import { TwitchGiftSubsGiveawayModule } from './twitch-gift-subs-giveaway/twitch-gift-subs-giveaway.module';
import { IntegratedBitsKickCoinsGiveawayModule } from './integrated-bits-kick-coins-giveaway/integrated-bits-kick-coins-giveaway.module';
import { IntegratedGiftSubsGiveawayModule } from './integrated-gift-subs-giveaway/integrated-gift-subs-giveaway.module';
import { RealtimeGatewayModule } from './realtime-gateway/realtime-gateway.module';
import { SocialGiveawayModule } from './social-giveaway/social-giveaway.module';
import { KickWebhooksModule } from './kick-webhooks/kick-webhooks.module';
import { KickModule } from './kick/kick.module';
import { TwitchModule } from './twitch/twitch.module';
import { TwitchWebhooksModule } from './twitch-webhooks/twitch-webhooks.module';
import { YouTubeChatModule } from './youtube-chat/youtube-chat.module';
import { TokenRefreshCronModule } from './token-refresh-cron/token-refresh-cron.module';
import { CleanupCronModule } from './cleanup-cron/cleanup-cron.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    StreamGiveawayRedisModule,
    AuthModule,
    UserModule,
    ConnectedAccountsModule,
    TicketConfigModule,
    GiveawayModule,
    KickGiftSubsGiveawayModule,
    KickCoinsGiveawayModule,
    TwitchBitsGiveawayModule,
    TwitchGiftSubsGiveawayModule,
    IntegratedBitsKickCoinsGiveawayModule,
    IntegratedGiftSubsGiveawayModule,
    RealtimeGatewayModule,
    SocialGiveawayModule,
    KickWebhooksModule,
    KickModule,
    TwitchModule,
    TwitchWebhooksModule,
    YouTubeChatModule,
    TokenRefreshCronModule,
    CleanupCronModule,
    EventsModule,
  ],
})
export class AppModule {}
