import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min } from 'class-validator';

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
}

