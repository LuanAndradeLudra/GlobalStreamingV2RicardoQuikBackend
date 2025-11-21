import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt, Min } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

export class CreateTicketGlobalRuleDto {
  @ApiProperty({
    description: 'Platform for this rule',
    enum: ConnectedPlatform,
    example: ConnectedPlatform.TWITCH,
  })
  @IsEnum(ConnectedPlatform)
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'User role/tier (e.g., "NON_SUB", "SUB_TIER_1", "SUB_TIER_2", "SUB_TIER_3", "SUB_KICK", "SUB_YOUTUBE", "GIFT_SUB_DONOR")',
    example: 'SUB_TIER_1',
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

