import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsArray, IsOptional, ArrayMinSize } from 'class-validator';
import { GiveawayType, ConnectedPlatform } from '@prisma/client';

export class CreateGiveawayDto {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Summer Giveaway 2024',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Type of giveaway',
    enum: GiveawayType,
    example: GiveawayType.LIVE_KEYWORD,
  })
  @IsEnum(GiveawayType)
  type: GiveawayType;

  @ApiProperty({
    description: 'Platforms where the giveaway will run',
    enum: ConnectedPlatform,
    isArray: true,
    example: [ConnectedPlatform.TWITCH, ConnectedPlatform.KICK],
  })
  @IsArray()
  @IsEnum(ConnectedPlatform, { each: true })
  @ArrayMinSize(1)
  platforms: ConnectedPlatform[];

  @ApiProperty({
    description: 'Keyword for LIVE_KEYWORD type giveaways',
    example: '!enter',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({
    description: 'Initial status of the giveaway (defaults to DRAFT if not provided)',
    enum: ['DRAFT', 'OPEN'],
    example: 'DRAFT',
    required: false,
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'OPEN'])
  status?: 'DRAFT' | 'OPEN';
}

