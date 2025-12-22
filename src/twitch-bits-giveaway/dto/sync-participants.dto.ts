import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsInt, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class TwitchBitsLeaderboardEntryDto {
  @ApiProperty({ description: 'User ID from Twitch' })
  @IsString()
  user_id: string;

  @ApiProperty({ description: 'User login from Twitch' })
  @IsString()
  user_login: string;

  @ApiProperty({ description: 'User name from Twitch' })
  @IsString()
  user_name: string;

  @ApiProperty({ description: 'Rank in leaderboard' })
  @IsInt()
  rank: number;

  @ApiProperty({ description: 'Score (bits amount)' })
  @IsInt()
  score: number;
}

class DateRangeDto {
  @ApiProperty({ description: 'Start date of the range', example: '2025-11-10T08:00:00Z' })
  @IsString()
  started_at: string;

  @ApiProperty({ description: 'End date of the range', example: '2025-11-17T08:00:00Z' })
  @IsString()
  ended_at: string;
}

export class SyncParticipantsDto {
  @ApiProperty({ description: 'Leaderboard data', type: [TwitchBitsLeaderboardEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TwitchBitsLeaderboardEntryDto)
  data: TwitchBitsLeaderboardEntryDto[];

  @ApiProperty({ description: 'Date range for the leaderboard', type: DateRangeDto, required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DateRangeDto)
  date_range?: DateRangeDto;

  @ApiProperty({ description: 'Total number of entries', required: false })
  @IsOptional()
  @IsInt()
  total?: number;
}










