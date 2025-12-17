import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegratedBitsKickCoinsGiveawayService } from './integrated-bits-kick-coins-giveaway.service';
import { CreateIntegratedBitsKickCoinsGiveawayDto } from './dto/create-integrated-bits-kick-coins-giveaway.dto';
import { UpdateIntegratedBitsKickCoinsGiveawayDto } from './dto/update-integrated-bits-kick-coins-giveaway.dto';
import { SyncIntegratedParticipantsDto } from './dto/sync-participants.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('integrated-bits-kick-coins-giveaways')
@ApiBearerAuth()
@Controller('integrated-bits-kick-coins-giveaways')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class IntegratedBitsKickCoinsGiveawayController {
  constructor(
    private readonly integratedBitsKickCoinsGiveawayService: IntegratedBitsKickCoinsGiveawayService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new integrated bits + kick coins giveaway' })
  create(
    @CurrentUser('id') userId: string,
    @Body() createDto: CreateIntegratedBitsKickCoinsGiveawayDto,
  ) {
    return this.integratedBitsKickCoinsGiveawayService.create(userId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all integrated bits + kick coins giveaways for the current user' })
  findAll(@CurrentUser('id') userId: string) {
    return this.integratedBitsKickCoinsGiveawayService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single integrated bits + kick coins giveaway by ID' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.integratedBitsKickCoinsGiveawayService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an integrated bits + kick coins giveaway' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateIntegratedBitsKickCoinsGiveawayDto,
  ) {
    return this.integratedBitsKickCoinsGiveawayService.update(userId, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an integrated bits + kick coins giveaway' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.integratedBitsKickCoinsGiveawayService.remove(userId, id);
  }

  @Post(':id/sync-participants')
  @ApiOperation({ summary: 'Sync participants from both Twitch Bits and Kick Coins leaderboards' })
  syncParticipants(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() syncDto: SyncIntegratedParticipantsDto,
  ) {
    return this.integratedBitsKickCoinsGiveawayService.syncParticipants(
      userId,
      id,
      syncDto.twitchBitsLeaderboard,
      syncDto.kickCoinsLeaderboard,
    );
  }

  @Post(':id/draw')
  @ApiOperation({ summary: 'Draw a winner from the integrated giveaway' })
  draw(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.integratedBitsKickCoinsGiveawayService.draw(userId, id);
  }
}





