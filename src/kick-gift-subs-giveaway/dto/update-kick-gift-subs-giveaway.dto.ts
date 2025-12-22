import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateKickGiftSubsGiveawayDto {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Weekly Kick Gift Subs Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}














