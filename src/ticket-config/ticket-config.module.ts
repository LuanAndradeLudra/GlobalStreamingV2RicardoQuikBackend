import { Module } from '@nestjs/common';
import { TicketConfigService } from './ticket-config.service';
import { TicketConfigController } from './ticket-config.controller';

// TicketConfigModule defines global rules for ticket acquisition and limits.
// These rules serve as defaults for all stream giveaways and can be configured per platform, role, and donation type.
@Module({
  controllers: [TicketConfigController],
  providers: [TicketConfigService],
  exports: [TicketConfigService],
})
export class TicketConfigModule {}
