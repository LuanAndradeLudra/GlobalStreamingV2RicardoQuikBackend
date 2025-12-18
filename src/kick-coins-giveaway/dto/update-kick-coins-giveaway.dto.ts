import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateKickCoinsGiveawayDto {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Weekly Kick Coins Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}







