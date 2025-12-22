import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { CreateTwitchGiftSubsGiveawayDto } from './create-twitch-gift-subs-giveaway.dto';

export class UpdateTwitchGiftSubsGiveawayDto extends PartialType(CreateTwitchGiftSubsGiveawayDto) {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Twitch Gift Subs Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}











