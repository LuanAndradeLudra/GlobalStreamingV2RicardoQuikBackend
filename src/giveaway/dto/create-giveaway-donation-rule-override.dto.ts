import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt, Min } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

export class CreateGiveawayDonationRuleOverrideDto {
  @ApiProperty({
    description: 'Platform for this donation rule override',
    enum: ConnectedPlatform,
    example: ConnectedPlatform.TWITCH,
  })
  @IsEnum(ConnectedPlatform)
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'Type of donation unit (e.g., "BITS", "GIFT_SUB", "KICK_COINS", "SUPERCHAT")',
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

