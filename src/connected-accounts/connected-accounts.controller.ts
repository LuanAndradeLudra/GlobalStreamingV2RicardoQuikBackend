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
import { ConnectedAccountsService } from './connected-accounts.service';
import { CreateConnectedAccountDto } from './dto/create-connected-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole, ConnectedAccount } from '@prisma/client';

@ApiTags('connected-accounts')
@Controller('connected-accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ConnectedAccountsController {
  constructor(private readonly connectedAccountsService: ConnectedAccountsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List connected accounts',
    description: 'Returns all connected accounts for the authenticated admin user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of connected accounts',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
          externalChannelId: { type: 'string' },
          displayName: { type: 'string' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string', nullable: true },
          scopes: { type: 'string', nullable: true },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
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
  async findAll(@CurrentUser() user: User): Promise<ConnectedAccount[]> {
    return this.connectedAccountsService.findAll(user.id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or update connected account',
    description:
      'Creates a new connected account or updates an existing one for the authenticated admin user',
  })
  @ApiResponse({
    status: 201,
    description: 'Connected account created or updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        platform: { type: 'string', enum: ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'] },
        externalChannelId: { type: 'string' },
        displayName: { type: 'string' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string', nullable: true },
        scopes: { type: 'string', nullable: true },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
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
  async createOrUpdate(
    @CurrentUser() user: User,
    @Body() createDto: CreateConnectedAccountDto,
  ): Promise<ConnectedAccount> {
    return this.connectedAccountsService.createOrUpdate(user.id, createDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete connected account',
    description: 'Removes a connected account for the authenticated admin user',
  })
  @ApiResponse({
    status: 204,
    description: 'Connected account deleted successfully',
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
    description: 'Connected account not found',
  })
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.connectedAccountsService.remove(user.id, id);
  }
}

