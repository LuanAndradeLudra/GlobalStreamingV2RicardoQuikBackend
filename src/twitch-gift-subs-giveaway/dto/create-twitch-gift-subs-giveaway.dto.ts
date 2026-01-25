import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TwitchGiftSubsCategory {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ACTIVE = 'ACTIVE',
}

export class CreateTwitchGiftSubsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway',
    enum: TwitchGiftSubsCategory,
    example: TwitchGiftSubsCategory.ACTIVE,
  })
  @IsEnum(TwitchGiftSubsCategory)
  @IsNotEmpty()
  category: TwitchGiftSubsCategory;

  @ApiProperty({
    description: 'Name of the giveaway (optional - will be auto-generated if not provided)',
    example: 'Twitch Gift Subs Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}












