import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, ValidateIf } from 'class-validator';
import { TwitchBitsCategory } from '@prisma/client';

export class CreateTwitchBitsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - DAILY, WEEKLY, or MONTHLY',
    enum: TwitchBitsCategory,
    example: TwitchBitsCategory.DAILY,
  })
  @IsEnum(TwitchBitsCategory)
  category: TwitchBitsCategory;

  @ApiProperty({
    description: 'Start date - Required for DAILY (specific day), WEEKLY (Monday of the week), MONTHLY (first day of month)',
    type: String,
    format: 'date-time',
    required: false,
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
