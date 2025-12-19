import { IsArray, IsNotEmpty, ValidateNested, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class TwitchSubscriptionDto {
  @ApiProperty({ description: 'Broadcaster ID' })
  @IsString()
  broadcaster_id: string;

  @ApiProperty({ description: 'Broadcaster login' })
  @IsString()
  broadcaster_login: string;

  @ApiProperty({ description: 'Broadcaster name' })
  @IsString()
  broadcaster_name: string;

  @ApiProperty({ description: 'Gifter ID (empty if not a gift)' })
  @IsString()
  gifter_id: string;

  @ApiProperty({ description: 'Gifter login (empty if not a gift)' })
  @IsString()
  gifter_login: string;

  @ApiProperty({ description: 'Gifter name (empty if not a gift)' })
  @IsString()
  gifter_name: string;

  @ApiProperty({ description: 'Is gift subscription' })
  @IsBoolean()
  is_gift: boolean;

  @ApiProperty({ description: 'Plan name' })
  @IsString()
  plan_name: string;

  @ApiProperty({ description: 'Tier (1000, 2000, 3000)' })
  @IsString()
  tier: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  user_id: string;

  @ApiProperty({ description: 'User name' })
  @IsString()
  user_name: string;

  @ApiProperty({ description: 'User login' })
  @IsString()
  user_login: string;
}

export class SyncParticipantsDto {
  @ApiProperty({
    description: 'Array of Twitch subscriptions',
    type: [TwitchSubscriptionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TwitchSubscriptionDto)
  @IsNotEmpty()
  data: TwitchSubscriptionDto[];
}








