import { IsEnum, IsString, IsInt, IsDateString, Min, Max } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

export class CreateVipUserDto {
  @IsEnum(['TWITCH', 'KICK'])
  platform: ConnectedPlatform;

  @IsString()
  platformUsername: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  bonusTickets: number;

  @IsDateString()
  expiresAt: string;
}
