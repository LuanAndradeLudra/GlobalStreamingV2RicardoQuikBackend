import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('kick-coins/daily')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get daily Kick Coins leaderboard from Event table',
    description: 'Returns Kick Coins donated today grouped by user. Used for DAILY giveaways.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily Kick Coins leaderboard retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              user_id: { type: 'string' },
              username: { type: 'string' },
              gifted_amount: { type: 'number' },
              rank: { type: 'number' },
            },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not an admin' })
  async getKickCoinsDaily(@CurrentUser() user: User) {
    return this.eventsService.getKickCoinsDaily(user.id);
  }

  @Get('kick-coins/weekly')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get weekly Kick Coins leaderboard from Event table',
    description: 'Returns Kick Coins donated this week grouped by user. Used for WEEKLY giveaways.',
  })
  @ApiResponse({
    status: 200,
    description: 'Weekly Kick Coins leaderboard retrieved successfully',
  })
  async getKickCoinsWeekly(@CurrentUser() user: User) {
    return this.eventsService.getKickCoinsWeekly(user.id);
  }

  @Get('kick-coins/monthly')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get monthly Kick Coins leaderboard from Event table',
    description: 'Returns Kick Coins donated this month grouped by user. Used for MONTHLY giveaways.',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly Kick Coins leaderboard retrieved successfully',
  })
  async getKickCoinsMonthly(@CurrentUser() user: User) {
    return this.eventsService.getKickCoinsMonthly(user.id);
  }

  @Get('twitch-gift-subs/daily')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get daily Twitch Gift Subs leaderboard from Event table',
    description: 'Returns Twitch Gift Subs gifted today grouped by gifter. Used for DAILY giveaways.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily Twitch Gift Subs leaderboard retrieved successfully',
  })
  async getTwitchGiftSubsDaily(@CurrentUser() user: User) {
    return this.eventsService.getTwitchGiftSubsDaily(user.id);
  }

  @Get('kick-gift-subs/daily')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get daily Kick Gift Subs leaderboard from Event table',
    description: 'Returns Kick Gift Subs gifted today grouped by gifter. Used for DAILY giveaways.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily Kick Gift Subs leaderboard retrieved successfully',
  })
  async getKickGiftSubsDaily(@CurrentUser() user: User) {
    return this.eventsService.getKickGiftSubsDaily(user.id);
  }
}

