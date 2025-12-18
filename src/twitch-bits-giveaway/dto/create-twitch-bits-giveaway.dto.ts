import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, ValidateIf, IsString } from 'class-validator';
import { TwitchBitsCategory } from '@prisma/client';

export class CreateTwitchBitsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - DAILY, WEEKLY, MONTHLY, or YEARLY',
    enum: TwitchBitsCategory,
    example: TwitchBitsCategory.DAILY,
  })
  @IsEnum(TwitchBitsCategory)
  category: TwitchBitsCategory;

  @ApiProperty({
    description: 'Start date - Required for DAILY (specific day), WEEKLY (Monday of the week), MONTHLY (first day of month), YEARLY (first day of year)',
    type: String,
    format: 'date-time',
    required: false,
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Name of the giveaway (optional - will be auto-generated if not provided)',
    example: 'Weekly Twitch Bits Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}






