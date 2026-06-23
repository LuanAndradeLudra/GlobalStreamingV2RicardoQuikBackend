import { Module } from '@nestjs/common';
import { VipUsersService } from './vip-users.service';
import { VipUsersController } from './vip-users.controller';

@Module({
  controllers: [VipUsersController],
  providers: [VipUsersService],
  exports: [VipUsersService],
})
export class VipUsersModule {}
