import { Module } from '@nestjs/common';
import { MonthlyWinLimitService } from './monthly-win-limit.service';
import { MonthlyWinLimitController } from './monthly-win-limit.controller';

@Module({
  controllers: [MonthlyWinLimitController],
  providers: [MonthlyWinLimitService],
  exports: [MonthlyWinLimitService],
})
export class MonthlyWinLimitModule {}
