import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateTwitchBitsGiveawayDto {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Weekly Twitch Bits Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}






