import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConnectedAccountsService } from './connected-accounts.service';
import { ConnectedAccountsController } from './connected-accounts.controller';
import { KickOAuthService } from './services/kick-oauth.service';
import { TwitchOAuthService } from './services/twitch-oauth.service';
import { YouTubeOAuthService } from './services/youtube-oauth.service';
import { YouTubeChatModule } from '../youtube-chat/youtube-chat.module';

// ConnectedAccountsModule will manage integrations with external channels (Twitch, Kick, YouTube, etc.).
@Module({
  imports: [ConfigModule, YouTubeChatModule],
  controllers: [ConnectedAccountsController],
  providers: [ConnectedAccountsService, KickOAuthService, TwitchOAuthService, YouTubeOAuthService],
  exports: [ConnectedAccountsService, KickOAuthService, TwitchOAuthService, YouTubeOAuthService],
})
export class ConnectedAccountsModule {}
