import {
  Controller,
  Get,
  Post,
  Patch,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole, Giveaway } from '@prisma/client';

@ApiTags('giveaways')
@Controller('giveaways')
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
      'Keyword is required for LIVE_KEYWORD type. ' +
      'Donation windows are required when includeBitsDonors or includeGiftSubDonors are true.',
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
        type: { type: 'string', enum: ['LIVE_KEYWORD', 'SUBS_ONLY', 'DONATION_ONLY', 'INSTAGRAM_COMMENTS', 'TIKTOK_COMMENTS', 'MANUAL'] },
        status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
        },
        keyword: { type: 'string', nullable: true },
        includeBitsDonors: { type: 'boolean' },
        includeGiftSubDonors: { type: 'boolean' },
        bitsDonationWindow: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'], nullable: true },
        giftSubDonationWindow: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'], nullable: true },
        configOverrideId: { type: 'string', nullable: true },
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
  ): Promise<Giveaway> {
    return this.giveawayService.create(user.id, dto);
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
          type: { type: 'string', enum: ['LIVE_KEYWORD', 'SUBS_ONLY', 'DONATION_ONLY', 'INSTAGRAM_COMMENTS', 'TIKTOK_COMMENTS', 'MANUAL'] },
          status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
          },
          keyword: { type: 'string', nullable: true },
          configOverrideId: { type: 'string', nullable: true },
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
  async findAll(@CurrentUser() user: User): Promise<Giveaway[]> {
    return this.giveawayService.findAll(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get giveaway details',
    description: 'Returns details of a specific giveaway. Ensures the giveaway belongs to the authenticated admin user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Giveaway retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['LIVE_KEYWORD', 'SUBS_ONLY', 'DONATION_ONLY', 'INSTAGRAM_COMMENTS', 'TIKTOK_COMMENTS', 'MANUAL'] },
        status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
        },
        keyword: { type: 'string', nullable: true },
        configOverrideId: { type: 'string', nullable: true },
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
  ): Promise<Giveaway> {
    return this.giveawayService.findOne(user.id, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a giveaway',
    description:
      'Updates a giveaway. Can update name, type, keyword, platforms, status, donation flags, and donation windows. ' +
      'Only one giveaway can be OPEN at a time per admin. Returns error 400 if trying to set OPEN when another already exists.',
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
        type: { type: 'string', enum: ['LIVE_KEYWORD', 'SUBS_ONLY', 'DONATION_ONLY', 'INSTAGRAM_COMMENTS', 'TIKTOK_COMMENTS', 'MANUAL'] },
        status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
        },
        keyword: { type: 'string', nullable: true },
        includeBitsDonors: { type: 'boolean' },
        includeGiftSubDonors: { type: 'boolean' },
        bitsDonationWindow: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'], nullable: true },
        giftSubDonationWindow: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'], nullable: true },
        configOverrideId: { type: 'string', nullable: true },
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
  ): Promise<Giveaway> {
    return this.giveawayService.update(user.id, id, dto);
  }
}

