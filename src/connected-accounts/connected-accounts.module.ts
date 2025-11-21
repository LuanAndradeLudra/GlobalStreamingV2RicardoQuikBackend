import { Module } from '@nestjs/common';
import { ConnectedAccountsService } from './connected-accounts.service';
import { ConnectedAccountsController } from './connected-accounts.controller';

// ConnectedAccountsModule will manage integrations with external channels (Twitch, Kick, etc.).
@Module({
  controllers: [ConnectedAccountsController],
  providers: [ConnectedAccountsService],
  exports: [ConnectedAccountsService],
})
export class ConnectedAccountsModule {}
