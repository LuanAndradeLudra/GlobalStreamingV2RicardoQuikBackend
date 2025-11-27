import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { Exclude } from 'class-transformer';
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

  // These properties are excluded from validation but may be present in the payload
  // They will be stripped out during transformation before validation
  @Exclude()
  id?: string;

  @Exclude()
  streamGiveawayId?: string;

  @Exclude()
  createdAt?: Date | string;

  @Exclude()
  updatedAt?: Date | string;
}

