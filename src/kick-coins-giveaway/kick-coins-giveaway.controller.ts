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
import { KickCoinsGiveawayService } from './kick-coins-giveaway.service';
import { CreateKickCoinsGiveawayDto } from './dto/create-kick-coins-giveaway.dto';
import { UpdateKickCoinsGiveawayDto } from './dto/update-kick-coins-giveaway.dto';
import { SyncParticipantsDto } from './dto/sync-participants.dto';
import { DrawResponseDto } from '../giveaway/dto/draw-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('kick-coins-giveaways')
@Controller('kick-coins-giveaways')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class KickCoinsGiveawayController {
  constructor(private readonly kickCoinsGiveawayService: KickCoinsGiveawayService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new Kick Coins giveaway',
    description: 'Creates a new Kick Coins giveaway for the authenticated admin user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Kick Coins Giveaway created successfully',
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
    @Body() dto: CreateKickCoinsGiveawayDto,
  ) {
    return this.kickCoinsGiveawayService.create(user.id, dto);
  }

  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'List all Kick Coins giveaways (public)',
    description: 'Returns all Kick Coins giveaways. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kick Coins Giveaways retrieved successfully',
  })
  async findAllPublic() {
    return this.kickCoinsGiveawayService.findAllPublic();
  }

  @Get('public/:id')
  @Public()
  @ApiOperation({
    summary: 'Get Kick Coins giveaway details (public)',
    description: 'Returns details of a specific Kick Coins giveaway including all participants. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kick Coins Giveaway retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Kick Coins Giveaway not found',
  })
  async findOnePublic(@Param('id') id: string) {
    return this.kickCoinsGiveawayService.findOnePublic(id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all Kick Coins giveaways',
    description: 'Returns all Kick Coins giveaways for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kick Coins Giveaways retrieved successfully',
  })
  async findAll(@CurrentUser() user: User) {
    return this.kickCoinsGiveawayService.findAll(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get Kick Coins giveaway details',
    description: 'Returns details of a specific Kick Coins giveaway including all participants and winners.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kick Coins Giveaway retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Kick Coins Giveaway not found',
  })
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.kickCoinsGiveawayService.findOne(user.id, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a Kick Coins giveaway',
    description: 'Deletes a Kick Coins giveaway and all associated data.',
  })
  @ApiResponse({
    status: 204,
    description: 'Kick Coins Giveaway deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Kick Coins Giveaway not found',
  })
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.kickCoinsGiveawayService.remove(user.id, id);
  }

  @Post(':id/sync-participants')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync participants from leaderboard data',
    description: 'Syncs participants from Kick Coins leaderboard data provided by frontend. Frontend should fetch leaderboard data first.',
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
    description: 'Kick Coins Giveaway not found',
  })
  async syncParticipants(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SyncParticipantsDto,
  ) {
    return this.kickCoinsGiveawayService.syncParticipants(user.id, id, dto as any);
  }

  @Post(':id/draw')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Draw a winner',
    description: 'Draws a winner from the Kick Coins giveaway using Random.org.',
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
    description: 'Kick Coins Giveaway not found',
  })
  async draw(@CurrentUser() user: User, @Param('id') id: string): Promise<DrawResponseDto> {
    return this.kickCoinsGiveawayService.draw(user.id, id);
  }
}











