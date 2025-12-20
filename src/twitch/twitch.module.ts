import { Module } from '@nestjs/common';
import { TwitchController } from './twitch.controller';
import { TwitchService } from './twitch.service';
import { ConnectedAccountsModule } from '../connected-accounts/connected-accounts.module';

@Module({
  imports: [ConnectedAccountsModule],
  controllers: [TwitchController],
  providers: [TwitchService],
  exports: [TwitchService],
})
export class TwitchModule {}









