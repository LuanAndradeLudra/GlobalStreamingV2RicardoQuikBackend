import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

export class CreateConnectedAccountDto {
  @ApiProperty({
    description: 'Platform of the connected account',
    enum: ConnectedPlatform,
    example: ConnectedPlatform.TWITCH,
  })
  @IsEnum(ConnectedPlatform)
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'External channel ID from the platform',
    example: '123456789',
  })
  @IsString()
  externalChannelId: string;

  @ApiProperty({
    description: 'Display name of the channel',
    example: 'MyChannel',
  })
  @IsString()
  displayName: string;

  @ApiProperty({
    description: 'OAuth access token',
    example: 'oauth_token_12345',
  })
  @IsString()
  accessToken: string;

  @ApiPropertyOptional({
    description: 'OAuth refresh token',
    example: 'refresh_token_12345',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'OAuth scopes granted',
    example: 'user:read:email channel:read:subscriptions',
  })
  @IsOptional()
  @IsString()
  scopes?: string;

  @ApiPropertyOptional({
    description: 'Token expiration date',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

