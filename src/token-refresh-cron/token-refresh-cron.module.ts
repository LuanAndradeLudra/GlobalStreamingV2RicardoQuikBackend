import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenRefreshCronService } from './token-refresh-cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConnectedAccountsModule } from '../connected-accounts/connected-accounts.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ConnectedAccountsModule,
  ],
  providers: [TokenRefreshCronService],
})
export class TokenRefreshCronModule {}


