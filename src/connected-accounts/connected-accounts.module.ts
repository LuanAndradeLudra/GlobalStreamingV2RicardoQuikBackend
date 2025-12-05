import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConnectedAccountsService } from './connected-accounts.service';
import { ConnectedAccountsController } from './connected-accounts.controller';
import { KickOAuthService } from './services/kick-oauth.service';

// ConnectedAccountsModule will manage integrations with external channels (Twitch, Kick, etc.).
@Module({
  imports: [ConfigModule],
  controllers: [ConnectedAccountsController],
  providers: [ConnectedAccountsService, KickOAuthService],
  exports: [ConnectedAccountsService, KickOAuthService],
})
export class ConnectedAccountsModule {}
