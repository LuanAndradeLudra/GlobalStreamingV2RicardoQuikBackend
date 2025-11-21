import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt, Min } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

/**
 * DTO for creating/updating global ticket rules.
 * These rules define tickets based on the user's base subscription status.
 * Roles represent the "base state" of the user: non-sub, twitch tier, kick sub, youtube sub.
 * NON_SUB must be platform-specific (e.g., NON_SUB for Twitch, NON_SUB for Kick).
 * Gift subs are handled in TicketGlobalDonationRule, not here.
 */
export class CreateTicketGlobalRuleDto {
  @ApiProperty({
    description: 'Platform for this rule',
    enum: ConnectedPlatform,
    example: ConnectedPlatform.TWITCH,
  })
  @IsEnum(ConnectedPlatform)
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'User role/tier representing base subscription status (e.g., "NON_SUB", "TWITCH_TIER_1", "TWITCH_TIER_2", "TWITCH_TIER_3", "KICK_SUB", "YOUTUBE_SUB")',
    example: 'TWITCH_TIER_1',
  })
  @IsString()
  role: string;

  @ApiProperty({
    description: 'Number of tickets per unit for this role',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  ticketsPerUnit: number;
}

