import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KickCoinsCategory } from '@prisma/client';

export class CreateKickCoinsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway - WEEKLY or MONTHLY',
    enum: KickCoinsCategory,
    example: KickCoinsCategory.WEEKLY,
  })
  @IsEnum(KickCoinsCategory)
  category: KickCoinsCategory;
}





