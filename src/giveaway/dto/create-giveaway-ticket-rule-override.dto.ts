import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min } from 'class-validator';
import { Exclude } from 'class-transformer';

export class CreateGiveawayTicketRuleOverrideDto {
  @ApiProperty({
    description: 'Role to override (e.g., "NON_SUB", "TWITCH_TIER_1", "TWITCH_TIER_2", "TWITCH_TIER_3", "KICK_SUB", "YOUTUBE_SUB")',
    example: 'TWITCH_TIER_1',
  })
  @IsString()
  role: string;

  @ApiProperty({
    description: 'Number of tickets per unit for this role override',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  ticketsPerUnit: number;

  // These properties are excluded from validation but may be present in the payload
  @Exclude()
  id?: string;

  @Exclude()
  streamGiveawayId?: string;

  @Exclude()
  createdAt?: Date | string;

  @Exclude()
  updatedAt?: Date | string;
}

