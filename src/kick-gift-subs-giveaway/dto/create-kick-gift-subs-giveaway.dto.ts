import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KickGiftSubsCategory } from '@prisma/client';

export class CreateKickGiftSubsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - WEEKLY or MONTHLY',
    enum: KickGiftSubsCategory,
    example: KickGiftSubsCategory.WEEKLY,
  })
  @IsEnum(KickGiftSubsCategory)
  category: KickGiftSubsCategory;
}








