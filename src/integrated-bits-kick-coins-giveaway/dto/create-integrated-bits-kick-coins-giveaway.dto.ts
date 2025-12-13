import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { IntegratedBitsKickCoinsCategory } from '@prisma/client';

export class CreateIntegratedBitsKickCoinsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - WEEKLY or MONTHLY',
    enum: IntegratedBitsKickCoinsCategory,
    example: IntegratedBitsKickCoinsCategory.WEEKLY,
  })
  @IsEnum(IntegratedBitsKickCoinsCategory)
  category: IntegratedBitsKickCoinsCategory;
}
