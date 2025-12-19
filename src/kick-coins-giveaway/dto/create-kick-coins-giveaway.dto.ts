import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { KickCoinsCategory } from '@prisma/client';

export class CreateKickCoinsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - WEEKLY or MONTHLY',
    enum: KickCoinsCategory,
    example: KickCoinsCategory.WEEKLY,
  })
  @IsEnum(KickCoinsCategory)
  category: KickCoinsCategory;

  @ApiProperty({
    description: 'Name of the giveaway (optional - will be auto-generated if not provided)',
    example: 'Weekly Kick Coins Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}








