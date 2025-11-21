import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt, Min } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

/**
 * DTO for creating/updating global donation rules.
 * These rules define extra ticket increments based on quantity of bits/coins/gifts.
 * Time window (daily/weekly/monthly) is not defined here; it will be set per giveaway.
 * 
 * Examples:
 *   - Bits: unitType="BITS", unitSize=100, ticketsPerUnitSize=1 → 100 bits = 1 ticket
 *   - Gift subs: unitType="GIFT_SUB", unitSize=1, ticketsPerUnitSize=4 → 1 gift = 4 tickets
 */
export class CreateTicketGlobalDonationRuleDto {
  @ApiProperty({
    description: 'Platform for this donation rule',
    enum: ConnectedPlatform,
    example: ConnectedPlatform.TWITCH,
  })
  @IsEnum(ConnectedPlatform)
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'Type of donation unit (e.g., "BITS", "GIFT_SUB", "KICK_COINS")',
    example: 'BITS',
  })
  @IsString()
  unitType: string;

  @ApiProperty({
    description: 'Size of the "block" of units (e.g., 100 bits, 1 gift)',
    example: 100,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  unitSize: number;

  @ApiProperty({
    description: 'Tickets per block (e.g., 1 ticket per 100 bits, 4 tickets per gift)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  ticketsPerUnitSize: number;
}

