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
import { IntegratedGiftSubsGiveawayService } from './integrated-gift-subs-giveaway.service';
import { CreateIntegratedGiftSubsGiveawayDto } from './dto/create-integrated-gift-subs-giveaway.dto';
import { UpdateIntegratedGiftSubsGiveawayDto } from './dto/update-integrated-gift-subs-giveaway.dto';
import { SyncIntegratedGiftSubsParticipantsDto } from './dto/sync-participants.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Integrated Gift Subs Giveaways')
@ApiBearerAuth()
@Controller('integrated-gift-subs-giveaways')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class IntegratedGiftSubsGiveawayController {
  constructor(private readonly service: IntegratedGiftSubsGiveawayService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Integrated Gift Subs giveaway' })
  create(
    @CurrentUser('id') userId: string,
    @Body() createDto: CreateIntegratedGiftSubsGiveawayDto,
  ) {
    return this.service.create(userId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Integrated Gift Subs giveaways' })
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific Integrated Gift Subs giveaway' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an Integrated Gift Subs giveaway' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateIntegratedGiftSubsGiveawayDto,
  ) {
    return this.service.update(userId, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an Integrated Gift Subs giveaway' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.remove(userId, id);
  }

  @Post(':id/sync-participants')
  @ApiOperation({ summary: 'Sync participants from both Twitch and Kick Gift Subs leaderboards' })
  syncParticipants(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() syncDto: SyncIntegratedGiftSubsParticipantsDto,
  ) {
    return this.service.syncParticipants(
      userId,
      id,
      syncDto.twitchGiftSubsLeaderboard,
      syncDto.kickGiftSubsLeaderboard,
    );
  }

  @Post(':id/draw')
  @ApiOperation({ summary: 'Draw a winner from the integrated gift subs giveaway' })
  draw(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.draw(userId, id);
  }
}


