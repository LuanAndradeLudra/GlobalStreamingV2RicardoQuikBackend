import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConnectedAccountsModule } from './connected-accounts/connected-accounts.module';
import { TicketConfigModule } from './ticket-config/ticket-config.module';
import { GiveawayModule } from './giveaway/giveaway.module';
import { RealtimeGatewayModule } from './realtime-gateway/realtime-gateway.module';
import { SocialGiveawayModule } from './social-giveaway/social-giveaway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    ConnectedAccountsModule,
    TicketConfigModule,
    GiveawayModule,
    RealtimeGatewayModule,
    SocialGiveawayModule,
  ],
})
export class AppModule {}
