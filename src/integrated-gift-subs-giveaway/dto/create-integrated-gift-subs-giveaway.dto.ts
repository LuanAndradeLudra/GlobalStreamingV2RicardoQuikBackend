import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { IntegratedGiftSubsCategory } from '@prisma/client';

export class CreateIntegratedGiftSubsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - ACTIVE (always)',
    enum: IntegratedGiftSubsCategory,
    example: IntegratedGiftSubsCategory.ACTIVE,
  })
  @IsEnum(IntegratedGiftSubsCategory)
  category: IntegratedGiftSubsCategory;

  @ApiProperty({
    description: 'Name of the giveaway (optional - will be auto-generated if not provided)',
    example: 'Integrated Gift Subs Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}






