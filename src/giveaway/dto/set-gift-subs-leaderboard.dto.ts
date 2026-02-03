import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class GiftSubsEntryDto {
  @ApiProperty({
    description: 'User ID from Kick',
    example: 1073577,
  })
  @IsNumber()
  user_id: number;

  @ApiProperty({
    description: 'Username on Kick',
    example: 'xand0',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Quantity of gift subs',
    example: 16,
  })
  @IsNumber()
  quantity: number;
}

export class SetGiftSubsLeaderboardDto {
  @ApiProperty({
    description: 'Weekly gift subs leaderboard from Kick API',
    type: [GiftSubsEntryDto],
    example: [
      { user_id: 87911649, username: 'anizzk', quantity: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GiftSubsEntryDto)
  gifts_week: GiftSubsEntryDto[];

  @ApiProperty({
    description: 'Monthly gift subs leaderboard from Kick API',
    type: [GiftSubsEntryDto],
    example: [
      { user_id: 87911649, username: 'anizzk', quantity: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GiftSubsEntryDto)
  gifts_month: GiftSubsEntryDto[];
}

