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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GiveawayService } from './giveaway.service';
import { CreateGiveawayDto } from './dto/create-giveaway.dto';
import { UpdateGiveawayDto } from './dto/update-giveaway.dto';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { CreateParticipantsBatchDto } from './dto/create-participants-batch.dto';
import { DrawResponseDto } from './dto/draw-response.dto';
import { SetGiftSubsLeaderboardDto } from './dto/set-gift-subs-leaderboard.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole, StreamGiveaway, StreamGiveawayParticipant } from '@prisma/client';

@ApiTags('stream-giveaways')
@Controller('stream-giveaways')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class GiveawayController {
  constructor(private readonly giveawayService: GiveawayService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new giveaway',
    description:
      'Creates a new giveaway for the authenticated admin user. ' +
      'Only one giveaway can be OPEN at a time per admin. Returns error 400 if trying to create OPEN when another already exists. ' +
      'Platforms must be stream platforms only (TWITCH, KICK, YOUTUBE). ' +
      'Keyword is required for all giveaways. ' +
      'Use subsOnly or nonSubsOnly shortcuts, or provide allowedRoles array. ' +
      'Donation configs define which donation types are enabled per platform with their time windows.',
  })
  @ApiResponse({
    status: 201,
      description: 'Giveaway created successfully',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE'] },
          },
          keyword: { type: 'string' },
          allowedRoles: {
            type: 'array',
            items: { type: 'string' },
          },
          donationConfigs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                platform: { type: 'string' },
                unitType: { type: 'string' },
                donationWindow: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
              },
            },
          },
          ticketRuleOverrides: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                role: { type: 'string' },
                ticketsPerUnit: { type: 'number' },
              },
            },
          },
          donationRuleOverrides: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                platform: { type: 'string' },
                unitType: { type: 'string' },
                unitSize: { type: 'number' },
                ticketsPerUnitSize: { type: 'number' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid payload or trying to create OPEN giveaway when another already exists',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateGiveawayDto,
  ): Promise<StreamGiveaway> {
    return this.giveawayService.create(user.id, dto);
  }

  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'List all giveaways (public)',
    description: 'Returns all giveaways. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Giveaways retrieved successfully',
  })
  async findAllPublic(): Promise<StreamGiveaway[]> {
    return this.giveawayService.findAllPublic();
  }

  @Get('public/:id')
  @Public()
  @ApiOperation({
    summary: 'Get stream giveaway details (public)',
    description: 'Returns details of a specific stream giveaway including all participants. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stream giveaway retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Stream giveaway not found',
  })
  async findOnePublic(@Param('id') id: string): Promise<StreamGiveaway> {
    return this.giveawayService.findOnePublic(id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all giveaways',
    description: 'Returns all giveaways for the authenticated admin user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Giveaways retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE'] },
          },
          keyword: { type: 'string' },
          allowedRoles: {
            type: 'array',
            items: { type: 'string' },
          },
          donationConfigs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                platform: { type: 'string' },
                unitType: { type: 'string' },
                donationWindow: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
              },
            },
          },
          ticketRuleOverrides: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                role: { type: 'string' },
                ticketsPerUnit: { type: 'number' },
              },
            },
          },
          donationRuleOverrides: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                platform: { type: 'string' },
                unitType: { type: 'string' },
                unitSize: { type: 'number' },
                ticketsPerUnitSize: { type: 'number' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
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
  async findAll(@CurrentUser() user: User): Promise<StreamGiveaway[]> {
    return this.giveawayService.findAll(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get stream giveaway details',
    description: 'Returns details of a specific stream giveaway including all participants. Ensures the stream giveaway belongs to the authenticated admin user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stream giveaway retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE'] },
        },
        keyword: { type: 'string' },
        allowedRoles: {
          type: 'array',
          items: { type: 'string' },
        },
        donationConfigs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              platform: { type: 'string' },
              unitType: { type: 'string' },
              donationWindow: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
            },
          },
        },
        ticketRuleOverrides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              role: { type: 'string' },
              ticketsPerUnit: { type: 'number' },
            },
          },
        },
        donationRuleOverrides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              platform: { type: 'string' },
              unitType: { type: 'string' },
              unitSize: { type: 'number' },
              ticketsPerUnitSize: { type: 'number' },
            },
          },
        },
        participants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              streamGiveawayId: { type: 'string' },
              platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
              externalUserId: { type: 'string' },
              username: { type: 'string' },
              avatarUrl: { type: 'string', nullable: true },
              method: {
                type: 'string',
                enum: [
                  'BITS',
                  'GIFT_SUB',
                  'KICK_COINS',
                  'SUPERCHAT',
                  'TWITCH_TIER_1',
                  'TWITCH_TIER_2',
                  'TWITCH_TIER_3',
                  'TWITCH_NON_SUB',
                  'KICK_SUB',
                  'KICK_NON_SUB',
                  'YOUTUBE_SUB',
                  'YOUTUBE_NON_SUB',
                ],
              },
              tickets: { type: 'number' },
              metadata: { type: 'object', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
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
  @ApiResponse({
    status: 404,
    description: 'Giveaway not found',
  })
  async findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<StreamGiveaway> {
    return this.giveawayService.findOne(user.id, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a giveaway',
    description:
      'Updates a giveaway. Can update name, description, keyword, platforms, status, allowedRoles, donation configs, and overrides. ' +
      'Only one giveaway can be OPEN at a time per admin. Returns error 400 if trying to set OPEN when another already exists. ' +
      'Platforms must be stream platforms only (TWITCH, KICK, YOUTUBE). ' +
      'Keyword is required for all giveaways. ' +
      'Use subsOnly or nonSubsOnly shortcuts, or provide allowedRoles array.',
  })
  @ApiResponse({
    status: 200,
    description: 'Giveaway updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE'] },
        },
        keyword: { type: 'string' },
        allowedRoles: {
          type: 'array',
          items: { type: 'string' },
        },
        donationConfigs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              platform: { type: 'string' },
              unitType: { type: 'string' },
              donationWindow: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
            },
          },
        },
        ticketRuleOverrides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              role: { type: 'string' },
              ticketsPerUnit: { type: 'number' },
            },
          },
        },
        donationRuleOverrides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              platform: { type: 'string' },
              unitType: { type: 'string' },
              unitSize: { type: 'number' },
              ticketsPerUnitSize: { type: 'number' },
            },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid payload or trying to set OPEN when another giveaway is already OPEN',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Giveaway not found',
  })
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateGiveawayDto,
  ): Promise<StreamGiveaway> {
    return this.giveawayService.update(user.id, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a stream giveaway',
    description: 'Deletes a stream giveaway. Ensures the giveaway belongs to the authenticated admin user. All related data (participants, configs, overrides) will be deleted as well.',
  })
  @ApiResponse({
    status: 204,
    description: 'Stream giveaway deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Stream giveaway not found',
  })
  async remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<void> {
    await this.giveawayService.remove(user.id, id);
  }

  @Post(':id/participants')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a participant entry to a stream giveaway',
    description: 'Adds a single participant entry to a stream giveaway. Allows multiple entries per user with different methods (e.g., Bits, Tier 3, non_sub).',
  })
  @ApiResponse({
    status: 201,
    description: 'Participant entry created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        streamGiveawayId: { type: 'string' },
        platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE'] },
        externalUserId: { type: 'string' },
        username: { type: 'string' },
        avatarUrl: { type: 'string', nullable: true },
        method: { type: 'string', enum: ['BITS', 'TWITCH_TIER_1', 'TWITCH_TIER_2', 'TWITCH_TIER_3', 'TWITCH_NON_SUB', 'KICK_SUB', 'KICK_NON_SUB', 'YOUTUBE_SUB', 'YOUTUBE_NON_SUB', 'GIFT_SUB', 'KICK_COINS', 'SUPERCHAT'] },
        tickets: { type: 'number' },
        metadata: { type: 'object', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
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
  @ApiResponse({
    status: 404,
    description: 'Stream giveaway not found',
  })
  async addParticipant(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateParticipantDto,
  ): Promise<StreamGiveawayParticipant> {
    return this.giveawayService.addParticipant(user.id, id, dto);
  }

  @Post(':id/participants/batch')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add multiple participant entries to a stream giveaway',
    description: 'Adds multiple participant entries to a stream giveaway in batch. Useful for testing or bulk imports. Allows multiple entries per user with different methods.',
  })
  @ApiResponse({
    status: 201,
    description: 'Participant entries created successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          streamGiveawayId: { type: 'string' },
          platform: { type: 'string' },
          externalUserId: { type: 'string' },
          username: { type: 'string' },
          method: { type: 'string' },
          tickets: { type: 'number' },
          metadata: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
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
  @ApiResponse({
    status: 404,
    description: 'Stream giveaway not found',
  })
  async addParticipantsBatch(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateParticipantsBatchDto,
  ): Promise<StreamGiveawayParticipant[]> {
    return this.giveawayService.addParticipantsBatch(user.id, id, dto);
  }

  @Get(':id/participants')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all participants for a stream giveaway',
    description: 'Returns all participant entries for a specific stream giveaway, ordered by creation date and tickets.',
  })
  @ApiResponse({
    status: 200,
    description: 'Participants retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          streamGiveawayId: { type: 'string' },
          platform: { type: 'string' },
          externalUserId: { type: 'string' },
          username: { type: 'string' },
          method: { type: 'string' },
          tickets: { type: 'number' },
          metadata: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
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
  @ApiResponse({
    status: 404,
    description: 'Stream giveaway not found',
  })
  async getParticipants(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<StreamGiveawayParticipant[]> {
    return this.giveawayService.getParticipants(user.id, id);
  }

  @Post(':id/draw')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Draw a winner from a stream giveaway',
    description:
      'Draws a winner from a stream giveaway using Random.org Signed API. ' +
      'Calculates ticket ranges for all participants, generates a hash of the participant list, ' +
      'calls Random.org to get a random number, and finds the winner using binary search. ' +
      'Returns an audit payload with all draw details including verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Winner drawn successfully',
    type: DrawResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no participants found or Random.org API error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthenticated - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Stream giveaway not found',
  })
  async draw(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<DrawResponseDto> {
    return this.giveawayService.draw(user.id, id);
  }

  @Get(':id/winner-messages')
  @Public()
  @ApiOperation({
    summary: 'Get winner messages',
    description:
      'Returns all messages from the current winner of a giveaway. ' +
      'Messages are stored in Redis with a TTL of 60 seconds after the winner is drawn. ' +
      'Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Winner messages retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        winner: {
          type: 'object',
          nullable: true,
          properties: {
            streamGiveawayId: { type: 'string' },
            username: { type: 'string' },
            platform: { type: 'string' },
            externalUserId: { type: 'string' },
            drawnAt: { type: 'string' },
          },
        },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Stream giveaway not found',
  })
  async getWinnerMessages(@Param('id') id: string): Promise<{
    winner: any;
    messages: any[];
  }> {
    return this.giveawayService.getWinnerMessages(id);
  }

  @Post('gift-subs-leaderboard')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set Kick Gift Subs leaderboard in Redis',
    description:
      'Receives weekly and monthly gift subs leaderboard data from Kick API and stores it in Redis. ' +
      'This data is used for WEEKLY and MONTHLY giveaways. For DAILY giveaways, data is fetched from the Event table.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gift subs leaderboard saved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
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
  async setGiftSubsLeaderboard(
    @CurrentUser() user: User,
    @Body() dto: SetGiftSubsLeaderboardDto,
  ): Promise<{ message: string }> {
    await this.giveawayService.setGiftSubsLeaderboard(user.id, dto);
    return { message: 'Gift subs leaderboard saved successfully' };
  }
}

