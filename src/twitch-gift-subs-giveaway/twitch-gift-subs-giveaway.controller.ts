import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TwitchGiftSubsGiveawayService } from './twitch-gift-subs-giveaway.service';
import { CreateTwitchGiftSubsGiveawayDto } from './dto/create-twitch-gift-subs-giveaway.dto';
import { SyncParticipantsDto } from './dto/sync-participants.dto';
import { DrawResponseDto } from '../giveaway/dto/draw-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('twitch-gift-subs-giveaways')
@Controller('twitch-gift-subs-giveaways')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class TwitchGiftSubsGiveawayController {
  constructor(private readonly twitchGiftSubsGiveawayService: TwitchGiftSubsGiveawayService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new Twitch Gift Subs giveaway',
    description: 'Creates a new Twitch Gift Subs giveaway for the authenticated admin user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Twitch Gift Subs Giveaway created successfully',
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
    @Body() dto: CreateTwitchGiftSubsGiveawayDto,
  ) {
    return this.twitchGiftSubsGiveawayService.create(user.id, dto);
  }

  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'List all Twitch Gift Subs giveaways (public)',
    description: 'Returns all Twitch Gift Subs giveaways. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Twitch Gift Subs Giveaways retrieved successfully',
  })
  async findAllPublic() {
    return this.twitchGiftSubsGiveawayService.findAllPublic();
  }

  @Get('public/:id')
  @Public()
  @ApiOperation({
    summary: 'Get Twitch Gift Subs giveaway details (public)',
    description: 'Returns details of a specific Twitch Gift Subs giveaway including all participants. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Twitch Gift Subs Giveaway retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Twitch Gift Subs Giveaway not found',
  })
  async findOnePublic(@Param('id') id: string) {
    return this.twitchGiftSubsGiveawayService.findOnePublic(id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all Twitch Gift Subs giveaways',
    description: 'Returns all Twitch Gift Subs giveaways for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Twitch Gift Subs Giveaways retrieved successfully',
  })
  async findAll(@CurrentUser() user: User) {
    return this.twitchGiftSubsGiveawayService.findAll(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get Twitch Gift Subs giveaway details',
    description: 'Returns details of a specific Twitch Gift Subs giveaway including all participants and winners.',
  })
  @ApiResponse({
    status: 200,
    description: 'Twitch Gift Subs Giveaway retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Twitch Gift Subs Giveaway not found',
  })
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.twitchGiftSubsGiveawayService.findOne(user.id, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a Twitch Gift Subs giveaway',
    description: 'Deletes a Twitch Gift Subs giveaway and all associated data.',
  })
  @ApiResponse({
    status: 204,
    description: 'Twitch Gift Subs Giveaway deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Twitch Gift Subs Giveaway not found',
  })
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.twitchGiftSubsGiveawayService.remove(user.id, id);
  }

  @Post(':id/sync-participants')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync participants from subscriptions data',
    description: 'Syncs participants from Twitch subscriptions data provided by frontend. Frontend should fetch subscriptions data first.',
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
    description: 'Twitch Gift Subs Giveaway not found',
  })
  async syncParticipants(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SyncParticipantsDto,
  ) {
    return this.twitchGiftSubsGiveawayService.syncParticipants(user.id, id, dto as any);
  }

  @Post(':id/draw')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Draw a winner',
    description: 'Draws a winner from the Twitch Gift Subs giveaway using Random.org.',
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
    description: 'Twitch Gift Subs Giveaway not found',
  })
  async draw(@CurrentUser() user: User, @Param('id') id: string): Promise<DrawResponseDto> {
    return this.twitchGiftSubsGiveawayService.draw(user.id, id);
  }
}











