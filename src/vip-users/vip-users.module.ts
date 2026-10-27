import { Module } from '@nestjs/common';
import { VipUsersService } from './vip-users.service';
import { VipUsersController } from './vip-users.controller';
import { VipIntegrationService } from './vip-integration.service';
import { VipIntegrationController } from './vip-integration.controller';
import { VipApiKeyGuard } from './guards/vip-api-key.guard';

@Module({
  controllers: [VipUsersController, VipIntegrationController],
  providers: [VipUsersService, VipIntegrationService, VipApiKeyGuard],
  exports: [VipUsersService],
})
export class VipUsersModule {}
