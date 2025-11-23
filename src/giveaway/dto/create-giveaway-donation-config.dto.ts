import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { ConnectedPlatform, DonationWindow } from '@prisma/client';

export class CreateGiveawayDonationConfigDto {
  @ApiProperty({
    description: 'Platform for this donation type',
    enum: ConnectedPlatform,
    example: ConnectedPlatform.TWITCH,
  })
  @IsEnum(ConnectedPlatform)
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'Type of donation unit (BITS, GIFT_SUB, KICK_COINS, SUPERCHAT)',
    example: 'BITS',
  })
  @IsString()
  unitType: string;

  @ApiProperty({
    description: 'Time window for donations (DAILY, WEEKLY, MONTHLY)',
    enum: DonationWindow,
    example: DonationWindow.DAILY,
  })
  @IsEnum(DonationWindow)
  donationWindow: DonationWindow;
}

