import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TwitchService } from './twitch.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('twitch')
@Controller('twitch')
export class TwitchController {
  constructor(private readonly twitchService: TwitchService) {}

  @Get('bits/leaderboard')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get Twitch Bits leaderboard',
    description: 'Returns the Twitch Bits leaderboard. Requires bearer token from connected Twitch account.',
  })
  @ApiQuery({
    name: 'period',
    required: true,
    enum: ['day', 'week', 'month', 'all', 'year'],
    description: 'Period for the leaderboard',
  })
  @ApiQuery({
    name: 'started_at',
    required: false,
    type: String,
    description: 'Start date in ISO 8601 format (required for custom periods)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no Twitch account connected or invalid parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  async getBitsLeaderboard(
    @CurrentUser() user: User,
    @Query('period') period: string,
    @Query('started_at') startedAt?: string,
  ): Promise<any> {
    if (!period || !['day', 'week', 'month', 'all', 'year'].includes(period)) {
      throw new BadRequestException('Invalid period. Must be one of: day, week, month, all, year');
    }

    return this.twitchService.getBitsLeaderboard(user.id, period as any, startedAt);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get users by IDs',
    description: 'Returns user information for the specified user IDs. Requires bearer token.',
  })
  @ApiQuery({
    name: 'id',
    required: true,
    type: [String],
    description: 'User IDs to fetch (can be multiple)',
    example: ['123', '456'],
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid IDs or no Twitch account connected',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  async getUsers(@CurrentUser() user: User, @Query('id') ids: string | string[]): Promise<any> {
    // Handle both single and multiple IDs
    const idArray = Array.isArray(ids) ? ids : [ids];
    
    if (idArray.length === 0) {
      throw new BadRequestException('At least one user ID is required');
    }

    return this.twitchService.getUsers(user.id, idArray);
  }
}
