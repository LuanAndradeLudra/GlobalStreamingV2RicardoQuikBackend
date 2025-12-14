import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { IntegratedGiftSubsCategory } from '@prisma/client';

export class CreateIntegratedGiftSubsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - ACTIVE (always)',
    enum: IntegratedGiftSubsCategory,
    example: IntegratedGiftSubsCategory.ACTIVE,
  })
  @IsEnum(IntegratedGiftSubsCategory)
  category: IntegratedGiftSubsCategory;
}

