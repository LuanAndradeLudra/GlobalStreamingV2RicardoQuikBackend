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
import { User, UserRole, TicketGlobalRule, TicketGlobalDonationRule, ConnectedPlatform } from '@prisma/client';

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
      'Global ticket rules define tickets based on the user\'s base subscription status. ' +
      'Donation rules define extra ticket increments based on quantity of bits/coins/gifts. ' +
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
              platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
              role: { type: 'string', description: 'Base subscription status role (e.g., "NON_SUB", "TWITCH_TIER_1", "KICK_SUB")' },
              ticketsPerUnit: { type: 'number' },
            },
          },
        },
        donationRules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
              unitType: { type: 'string', description: 'Type of donation unit (e.g., "BITS", "GIFT_SUB", "KICK_COINS", "SUPERCHAT")' },
              unitSize: { type: 'number', description: 'Size of the "block" of units (e.g., 100 bits, 1 gift)' },
              ticketsPerUnitSize: { type: 'number', description: 'Tickets per block (e.g., 1 ticket per 100 bits, 4 tickets per gift)' },
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
    rules: { platform: string; role: string; ticketsPerUnit: number }[];
    donationRules: {
      platform: string;
      unitType: string;
      unitSize: number;
      ticketsPerUnitSize: number;
    }[];
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
      'These rules define tickets based on the user\'s base subscription status. ' +
      'Roles represent the "base state" of the user: non-sub, twitch tier, kick sub, youtube sub. ' +
      'Gift subs are handled in donation rules, not here. ' +
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
      'These rules define extra ticket increments based on quantity of bits/coins/gifts. ' +
      'Time window (daily/weekly/monthly) is not defined here; it will be set per giveaway. ' +
      'Examples: unitType="BITS", unitSize=100, ticketsPerUnitSize=1 → 100 bits = 1 ticket; ' +
      'unitType="GIFT_SUB", unitSize=1, ticketsPerUnitSize=4 → 1 gift = 4 tickets. ' +
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
              unitSize: { type: 'number' },
              ticketsPerUnitSize: { type: 'number' },
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

