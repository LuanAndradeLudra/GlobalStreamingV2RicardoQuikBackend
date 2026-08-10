import { IsInt, Min, Max, IsOptional, IsEnum, IsString } from 'class-validator';
import { ConnectedPlatform } from '@prisma/client';

export class UpdateMonthlyWinExtraWinnerDto {
  @IsOptional()
  @IsEnum(['TWITCH', 'KICK'])
  platform?: ConnectedPlatform;

  @IsOptional()
  @IsString()
  platformUsername?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxWins?: number;
}
