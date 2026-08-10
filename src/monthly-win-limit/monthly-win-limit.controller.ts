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
import { MonthlyWinLimitService } from './monthly-win-limit.service';
import { UpdateMonthlyWinLimitConfigDto } from './dto/update-monthly-win-limit-config.dto';
import { CreateMonthlyWinExtraWinnerDto } from './dto/create-monthly-win-extra-winner.dto';
import { UpdateMonthlyWinExtraWinnerDto } from './dto/update-monthly-win-extra-winner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole, MonthlyWinExtraWinner, MonthlyWinLimitConfig } from '@prisma/client';

@ApiTags('monthly-win-limit')
@Controller('monthly-win-limit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MonthlyWinLimitController {
  constructor(private readonly monthlyWinLimitService: MonthlyWinLimitService) {}

  @Get('config')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get monthly win limit config (creates defaults if missing)' })
  async getConfig(@CurrentUser() user: User): Promise<MonthlyWinLimitConfig> {
    return this.monthlyWinLimitService.getOrCreateConfig(user.id);
  }

  @Patch('config')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update monthly win limit config (enabled + max wins)' })
  async updateConfig(
    @CurrentUser() user: User,
    @Body() dto: UpdateMonthlyWinLimitConfigDto,
  ): Promise<MonthlyWinLimitConfig> {
    return this.monthlyWinLimitService.updateConfig(user.id, dto);
  }

  @Get('extra-winners')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List extra winners allowed beyond the default monthly limit' })
  async listExtraWinners(@CurrentUser() user: User): Promise<MonthlyWinExtraWinner[]> {
    return this.monthlyWinLimitService.findAllExtraWinners(user.id);
  }

  @Post('extra-winners')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an extra winner (nick + max chances)' })
  async createExtraWinner(
    @CurrentUser() user: User,
    @Body() dto: CreateMonthlyWinExtraWinnerDto,
  ): Promise<MonthlyWinExtraWinner> {
    return this.monthlyWinLimitService.createExtraWinner(user.id, dto);
  }

  @Patch('extra-winners/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an extra winner' })
  async updateExtraWinner(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMonthlyWinExtraWinnerDto,
  ): Promise<MonthlyWinExtraWinner> {
    return this.monthlyWinLimitService.updateExtraWinner(user.id, id, dto);
  }

  @Delete('extra-winners/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an extra winner' })
  async removeExtraWinner(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.monthlyWinLimitService.removeExtraWinner(user.id, id);
  }
}
