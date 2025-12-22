import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsInt, IsString, IsObject, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class KickCoinsLeaderboardEntryDto {
  @ApiProperty({ description: 'User ID from Kick' })
  @IsInt()
  user_id: number;

  @ApiProperty({ description: 'Username' })
  @IsString()
  username: string;

  @ApiProperty({ description: 'Gifted amount of kick coins' })
  @IsInt()
  gifted_amount: number;

  @ApiProperty({ description: 'Rank in leaderboard' })
  @IsInt()
  rank: number;
}

class KickCoinsLeaderboardDataDto {
  @ApiProperty({ description: 'Lifetime leaderboard', type: [KickCoinsLeaderboardEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KickCoinsLeaderboardEntryDto)
  lifetime: KickCoinsLeaderboardEntryDto[];

  @ApiProperty({ description: 'Monthly leaderboard', type: [KickCoinsLeaderboardEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KickCoinsLeaderboardEntryDto)
  month: KickCoinsLeaderboardEntryDto[];

  @ApiProperty({ description: 'Weekly leaderboard', type: [KickCoinsLeaderboardEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KickCoinsLeaderboardEntryDto)
  week: KickCoinsLeaderboardEntryDto[];
}

export class SyncParticipantsDto {
  @ApiProperty({ description: 'Leaderboard data', type: KickCoinsLeaderboardDataDto })
  @IsObject()
  @ValidateNested()
  @Type(() => KickCoinsLeaderboardDataDto)
  data: KickCoinsLeaderboardDataDto;

  @ApiProperty({ description: 'Response message', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}










