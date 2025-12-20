import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { CreateIntegratedGiftSubsGiveawayDto } from './create-integrated-gift-subs-giveaway.dto';

export class UpdateIntegratedGiftSubsGiveawayDto extends PartialType(CreateIntegratedGiftSubsGiveawayDto) {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Integrated Gift Subs Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}









