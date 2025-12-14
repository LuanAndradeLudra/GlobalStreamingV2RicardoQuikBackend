import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime-gateway.gateway';

@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeGatewayModule {}
