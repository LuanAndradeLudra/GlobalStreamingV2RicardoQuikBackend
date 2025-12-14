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
import { KickGiftSubsGiveawayService } from './kick-gift-subs-giveaway.service';
import { CreateKickGiftSubsGiveawayDto } from './dto/create-kick-gift-subs-giveaway.dto';
import { UpdateKickGiftSubsGiveawayDto } from './dto/update-kick-gift-subs-giveaway.dto';
import { SyncParticipantsDto } from './dto/sync-participants.dto';
import { DrawResponseDto } from '../giveaway/dto/draw-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('kick-gift-subs-giveaways')
@Controller('kick-gift-subs-giveaways')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class KickGiftSubsGiveawayController {
  constructor(private readonly kickGiftSubsGiveawayService: KickGiftSubsGiveawayService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new Kick Gift Subs giveaway',
    description: 'Creates a new Kick Gift Subs giveaway for the authenticated admin user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Kick Gift Subs Giveaway created successfully',
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
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateKickGiftSubsGiveawayDto,
  ) {
    return this.kickGiftSubsGiveawayService.create(user.id, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all Kick Gift Subs giveaways',
    description: 'Returns all Kick Gift Subs giveaways for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kick Gift Subs Giveaways retrieved successfully',
  })
  async findAll(@CurrentUser() user: User) {
    return this.kickGiftSubsGiveawayService.findAll(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get Kick Gift Subs giveaway details',
    description: 'Returns details of a specific Kick Gift Subs giveaway including all participants and winners.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kick Gift Subs Giveaway retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Kick Gift Subs Giveaway not found',
  })
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.kickGiftSubsGiveawayService.findOne(user.id, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a Kick Gift Subs giveaway',
    description: 'Deletes a Kick Gift Subs giveaway and all associated data.',
  })
  @ApiResponse({
    status: 204,
    description: 'Kick Gift Subs Giveaway deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Kick Gift Subs Giveaway not found',
  })
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.kickGiftSubsGiveawayService.remove(user.id, id);
  }

  @Post(':id/sync-participants')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync participants from leaderboard data',
    description: 'Syncs participants from Kick leaderboard data provided by frontend. Frontend should fetch leaderboard data first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Participants synced and created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid data or gifts not enabled',
  })
  @ApiResponse({
    status: 404,
    description: 'Kick Gift Subs Giveaway not found',
  })
  async syncParticipants(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SyncParticipantsDto,
  ) {
    return this.kickGiftSubsGiveawayService.syncParticipants(user.id, id, dto as any);
  }

  @Post(':id/draw')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Draw a winner',
    description: 'Draws a winner from the Kick Gift Subs giveaway using Random.org.',
  })
  @ApiResponse({
    status: 200,
    description: 'Winner drawn successfully',
    type: DrawResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot draw (no participants or invalid status)',
  })
  @ApiResponse({
    status: 404,
    description: 'Kick Gift Subs Giveaway not found',
  })
  async draw(@CurrentUser() user: User, @Param('id') id: string): Promise<DrawResponseDto> {
    return this.kickGiftSubsGiveawayService.draw(user.id, id);
  }
}





