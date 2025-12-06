import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { KickService } from './kick.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('kick')
@Controller('kick')
export class KickController {
  constructor(private readonly kickService: KickService) {}

  @Post('send-chat-message')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send a chat message to Kick channel',
    description:
      'Sends a chat message to the connected Kick channel. Requires chat:write scope. See https://docs.kick.com/apis/chat',
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid message or missing channel',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token or missing chat:write scope',
  })
  async sendChatMessage(
    @CurrentUser() user: User,
    @Body()
    body: {
      message: string;
      channelId?: number;
      type?: 'user' | 'bot';
      replyToMessageId?: string;
    },
  ): Promise<any> {
    return this.kickService.sendChatMessage(
      user.id,
      body.message,
      body.channelId,
      body.type,
      body.replyToMessageId,
    );
  }

  @Get('kicks/leaderboard')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get Kick coins leaderboard',
    description: 'Returns the Kick coins leaderboard. Requires bearer token from connected Kick account.',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no Kick account connected',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  async getKickCoins(@CurrentUser() user: User): Promise<any> {
    return this.kickService.getKickCoinsLeaderboard(user.id);
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
    type: [Number],
    description: 'User IDs to fetch (can be multiple)',
    example: [123, 456],
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid IDs or no Kick account connected',
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

    // Convert to numbers
    const userIds = idArray.map((id) => {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        throw new BadRequestException(`Invalid user ID: ${id}`);
      }
      return numId;
    });

    return this.kickService.getUsers(user.id, userIds);
  }

  @Get('channels/:channelName/leaderboards')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get gift subs leaderboard',
    description:
      'Returns the gift subs leaderboard for a specific channel. Requires bearer token and channel name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gift subs leaderboard retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid channel name or no Kick account connected',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  async getGiftSubs(
    @CurrentUser() user: User,
    @Param('channelName') channelName: string,
    @Req() req: Request,
  ): Promise<any> {
    if (!channelName || channelName.trim().length === 0) {
      throw new BadRequestException('Channel name is required');
    }

    // Extract browser headers to pass to Kick API
    const browserHeaders: Record<string, string> = {};
    if (req.headers['user-agent']) {
      browserHeaders['user-agent'] = req.headers['user-agent'] as string;
    }
    if (req.headers['accept-language']) {
      browserHeaders['accept-language'] = req.headers['accept-language'] as string;
    }

    return this.kickService.getGiftSubsLeaderboard(user.id, channelName.trim(), browserHeaders);
  }

  @Get('channels/:channelName')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get channel information',
    description: 'Returns channel information for a specific channel. Requires bearer token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Channel information retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid channel name or no Kick account connected',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  async getChannel(@CurrentUser() user: User, @Param('channelName') channelName: string, @Req() req: Request): Promise<any> {
    if (!channelName || channelName.trim().length === 0) {
      throw new BadRequestException('Channel name is required');
    }

     // Extract browser headers to pass to Kick API
     const browserHeaders: Record<string, string> = {};
     if (req.headers['user-agent']) {
       browserHeaders['user-agent'] = req.headers['user-agent'] as string;
     }
     if (req.headers['accept-language']) {
       browserHeaders['accept-language'] = req.headers['accept-language'] as string;
     }

    return this.kickService.getChannel(user.id, channelName.trim(), browserHeaders);
  }
}

