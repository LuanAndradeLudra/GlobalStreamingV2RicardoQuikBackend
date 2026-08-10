import { IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

export class CreateMonthlyWinExtraWinnerDto {
  @IsEnum(['TWITCH', 'KICK'])
  platform: ConnectedPlatform;

  @IsString()
  platformUsername: string;

  @IsInt()
  @Min(1)
  @Max(100)
  maxWins: number;
}
