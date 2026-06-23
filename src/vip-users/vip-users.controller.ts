import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VipUsersService } from './vip-users.service';
import { CreateVipUserDto } from './dto/create-vip-user.dto';
import { UpdateVipUserDto } from './dto/update-vip-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole, VipUser } from '@prisma/client';

@ApiTags('vip-users')
@Controller('vip-users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class VipUsersController {
  constructor(private readonly vipUsersService: VipUsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all VIP users (active and expired)' })
  async findAll(@CurrentUser() user: User): Promise<VipUser[]> {
    return this.vipUsersService.findAll(user.id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new VIP user' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateVipUserDto,
  ): Promise<VipUser> {
    return this.vipUsersService.create(user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update VIP user (renew expiry or change bonus tickets)' })
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateVipUserDto,
  ): Promise<VipUser> {
    return this.vipUsersService.update(user.id, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a VIP user' })
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.vipUsersService.remove(user.id, id);
  }
}
