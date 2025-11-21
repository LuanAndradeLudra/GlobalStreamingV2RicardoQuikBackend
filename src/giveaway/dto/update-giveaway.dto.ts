import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsArray, IsOptional, ArrayMinSize } from 'class-validator';
import { GiveawayType, GiveawayStatus, ConnectedPlatform } from '@prisma/client';

export class UpdateGiveawayDto {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Summer Giveaway 2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Type of giveaway',
    enum: GiveawayType,
    example: GiveawayType.LIVE_KEYWORD,
    required: false,
  })
  @IsOptional()
  @IsEnum(GiveawayType)
  type?: GiveawayType;

  @ApiProperty({
    description: 'Status of the giveaway',
    enum: GiveawayStatus,
    example: GiveawayStatus.OPEN,
    required: false,
  })
  @IsOptional()
  @IsEnum(GiveawayStatus)
  status?: GiveawayStatus;

  @ApiProperty({
    description: 'Platforms where the giveaway will run',
    enum: ConnectedPlatform,
    isArray: true,
    example: [ConnectedPlatform.TWITCH, ConnectedPlatform.KICK],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ConnectedPlatform, { each: true })
  @ArrayMinSize(1)
  platforms?: ConnectedPlatform[];

  @ApiProperty({
    description: 'Keyword for LIVE_KEYWORD type giveaways',
    example: '!enter',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}

