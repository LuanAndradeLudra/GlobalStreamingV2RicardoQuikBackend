import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TicketConfigService } from './ticket-config.service';
import { UpsertTicketGlobalRulesDto } from './dto/upsert-ticket-global-rules.dto';
import { UpsertTicketGlobalDonationRulesDto } from './dto/upsert-ticket-global-donation-rules.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole, TicketGlobalRule, TicketGlobalDonationRule } from '@prisma/client';

@ApiTags('ticket-config')
@Controller('ticket-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TicketConfigController {
  constructor(private readonly ticketConfigService: TicketConfigService) {}

  @Get('global')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get global ticket configuration',
    description:
      'Returns all global ticket rules and donation rules for the authenticated admin user. ' +
      'These rules serve as defaults for all giveaways.',
  })
  @ApiResponse({
    status: 200,
    description: 'Global ticket configuration retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              userId: { type: 'string' },
              platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
              role: { type: 'string' },
              ticketsPerUnit: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        donationRules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              userId: { type: 'string' },
              platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
              unitType: { type: 'string' },
              unitsPerTicket: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  async getGlobalConfig(
    @CurrentUser() user: User,
  ): Promise<{
    rules: TicketGlobalRule[];
    donationRules: TicketGlobalDonationRule[];
  }> {
    return this.ticketConfigService.getGlobalConfig(user.id);
  }

  @Post('global/rules')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or update global ticket rules',
    description:
      'Creates or updates global ticket rules for the authenticated admin user. ' +
      'These rules define how many tickets each user role/tier receives. ' +
      'These are default rules applied to all giveaways.',
  })
  @ApiResponse({
    status: 200,
    description: 'Global ticket rules created or updated successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
          role: { type: 'string' },
          ticketsPerUnit: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid payload',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  async upsertGlobalRules(
    @CurrentUser() user: User,
    @Body() dto: UpsertTicketGlobalRulesDto,
  ): Promise<TicketGlobalRule[]> {
    return this.ticketConfigService.upsertGlobalRules(user.id, dto.rules);
  }

  @Post('global/donation-rules')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or update global donation rules',
    description:
      'Creates or updates global donation rules for the authenticated admin user. ' +
      'These rules define how many units (bits, coins, etc.) equal one ticket. ' +
      'These are default rules applied to all giveaways.',
  })
  @ApiResponse({
    status: 200,
    description: 'Global donation rules created or updated successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
          unitType: { type: 'string' },
          unitsPerTicket: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid payload',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  async upsertGlobalDonationRules(
    @CurrentUser() user: User,
    @Body() dto: UpsertTicketGlobalDonationRulesDto,
  ): Promise<TicketGlobalDonationRule[]> {
    return this.ticketConfigService.upsertGlobalDonationRules(user.id, dto.donationRules);
  }
}

