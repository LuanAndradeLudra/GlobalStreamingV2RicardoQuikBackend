import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, ValidateIf } from 'class-validator';
import { TwitchBitsCategory } from '@prisma/client';

export class CreateTwitchBitsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - DAILY, WEEKLY, MONTHLY or CUSTOM',
    enum: TwitchBitsCategory,
    example: TwitchBitsCategory.DAILY,
  })
  @IsEnum(TwitchBitsCategory)
  category: TwitchBitsCategory;

  @ApiProperty({
    description: 'Start date - Required for DAILY (specific day), WEEKLY (Monday of the week), MONTHLY (first day of month), CUSTOM (custom start)',
    type: String,
    format: 'date-time',
    required: false,
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for custom period (required if category is CUSTOM)',
    type: String,
    format: 'date-time',
    required: false,
    example: '2025-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @ValidateIf((o) => o.category === 'CUSTOM')
  @IsDateString()
  endDate?: string;
}
