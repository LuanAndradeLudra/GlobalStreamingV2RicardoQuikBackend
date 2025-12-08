import { Module } from '@nestjs/common';
import { KickController } from './kick.controller';
import { KickService } from './kick.service';
import { ConnectedAccountsModule } from '../connected-accounts/connected-accounts.module';

@Module({
  imports: [ConnectedAccountsModule],
  controllers: [KickController],
  providers: [KickService],
  exports: [KickService],
})
export class KickModule {}




