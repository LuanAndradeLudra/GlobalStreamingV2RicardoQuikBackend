import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { IntegratedBitsKickCoinsCategory } from '@prisma/client';

export class CreateIntegratedBitsKickCoinsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - WEEKLY or MONTHLY',
    enum: IntegratedBitsKickCoinsCategory,
    example: IntegratedBitsKickCoinsCategory.WEEKLY,
  })
  @IsEnum(IntegratedBitsKickCoinsCategory)
  category: IntegratedBitsKickCoinsCategory;

  @ApiProperty({
    description: 'Name of the giveaway (optional - will be auto-generated if not provided)',
    example: 'Weekly Bits & Kick Coins Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}





