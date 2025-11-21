import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt, Min } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

export class CreateTicketGlobalDonationRuleDto {
  @ApiProperty({
    description: 'Platform for this donation rule',
    enum: ConnectedPlatform,
    example: ConnectedPlatform.TWITCH,
  })
  @IsEnum(ConnectedPlatform)
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'Type of donation unit (e.g., "BITS", "KICK_COINS")',
    example: 'BITS',
  })
  @IsString()
  unitType: string;

  @ApiProperty({
    description: 'Number of units required per ticket (e.g., 100 = 100 bits = 1 ticket)',
    example: 100,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  unitsPerTicket: number;
}

