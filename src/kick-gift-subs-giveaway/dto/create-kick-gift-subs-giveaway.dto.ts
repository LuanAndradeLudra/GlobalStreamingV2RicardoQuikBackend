import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { KickGiftSubsCategory } from '@prisma/client';

export class CreateKickGiftSubsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - WEEKLY or MONTHLY',
    enum: KickGiftSubsCategory,
    example: KickGiftSubsCategory.WEEKLY,
  })
  @IsEnum(KickGiftSubsCategory)
  category: KickGiftSubsCategory;

  @ApiProperty({
    description: 'Name of the giveaway (optional - will be auto-generated if not provided)',
    example: 'Weekly Kick Gift Subs Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}








