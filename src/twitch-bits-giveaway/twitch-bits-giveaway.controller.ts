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
import { TwitchBitsGiveawayService } from './twitch-bits-giveaway.service';
import { CreateTwitchBitsGiveawayDto } from './dto/create-twitch-bits-giveaway.dto';
import { UpdateTwitchBitsGiveawayDto } from './dto/update-twitch-bits-giveaway.dto';
import { SyncParticipantsDto } from './dto/sync-participants.dto';
import { DrawResponseDto } from '../giveaway/dto/draw-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('twitch-bits-giveaways')
@Controller('twitch-bits-giveaways')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class TwitchBitsGiveawayController {
  constructor(private readonly twitchBitsGiveawayService: TwitchBitsGiveawayService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new Twitch Bits giveaway',
    description: 'Creates a new Twitch Bits giveaway for the authenticated admin user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Twitch Bits Giveaway created successfully',
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
    @Body() dto: CreateTwitchBitsGiveawayDto,
  ) {
    return this.twitchBitsGiveawayService.create(user.id, dto);
  }

  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'List all Twitch Bits giveaways (public)',
    description: 'Returns all Twitch Bits giveaways. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Twitch Bits Giveaways retrieved successfully',
  })
  async findAllPublic() {
    return this.twitchBitsGiveawayService.findAllPublic();
  }

  @Get('public/:id')
  @Public()
  @ApiOperation({
    summary: 'Get Twitch Bits giveaway details (public)',
    description: 'Returns details of a specific Twitch Bits giveaway including all participants. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Twitch Bits Giveaway retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Twitch Bits Giveaway not found',
  })
  async findOnePublic(@Param('id') id: string) {
    return this.twitchBitsGiveawayService.findOnePublic(id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all Twitch Bits giveaways',
    description: 'Returns all Twitch Bits giveaways for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Twitch Bits Giveaways retrieved successfully',
  })
  async findAll(@CurrentUser() user: User) {
    return this.twitchBitsGiveawayService.findAll(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get Twitch Bits giveaway details',
    description: 'Returns details of a specific Twitch Bits giveaway including all participants and winners.',
  })
  @ApiResponse({
    status: 200,
    description: 'Twitch Bits Giveaway retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Twitch Bits Giveaway not found',
  })
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.twitchBitsGiveawayService.findOne(user.id, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a Twitch Bits giveaway',
    description: 'Deletes a Twitch Bits giveaway and all associated data.',
  })
  @ApiResponse({
    status: 204,
    description: 'Twitch Bits Giveaway deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Twitch Bits Giveaway not found',
  })
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.twitchBitsGiveawayService.remove(user.id, id);
  }

  @Post(':id/sync-participants')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync participants from leaderboard data',
    description: 'Syncs participants from Twitch Bits leaderboard data provided by frontend. Frontend should fetch leaderboard data first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Participants synced and created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid data',
  })
  @ApiResponse({
    status: 404,
    description: 'Twitch Bits Giveaway not found',
  })
  async syncParticipants(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SyncParticipantsDto,
  ) {
    return this.twitchBitsGiveawayService.syncParticipants(user.id, id, dto as any);
  }

  @Post(':id/draw')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Draw a winner',
    description: 'Draws a winner from the Twitch Bits giveaway using Random.org.',
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
    description: 'Twitch Bits Giveaway not found',
  })
  async draw(@CurrentUser() user: User, @Param('id') id: string): Promise<DrawResponseDto> {
    return this.twitchBitsGiveawayService.draw(user.id, id);
  }
}






