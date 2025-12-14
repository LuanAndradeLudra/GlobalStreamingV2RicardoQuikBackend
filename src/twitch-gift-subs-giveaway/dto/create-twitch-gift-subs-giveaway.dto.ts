import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TwitchGiftSubsCategory {
  ACTIVE = 'ACTIVE',
}

export class CreateTwitchGiftSubsGiveawayDto {
  @ApiProperty({
    description: 'Category of the giveaway (always ACTIVE for Twitch Gift Subs)',
    enum: TwitchGiftSubsCategory,
    example: TwitchGiftSubsCategory.ACTIVE,
  })
  @IsEnum(TwitchGiftSubsCategory)
  @IsNotEmpty()
  category: TwitchGiftSubsCategory;
}

