import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { CreateIntegratedBitsKickCoinsGiveawayDto } from './create-integrated-bits-kick-coins-giveaway.dto';

export class UpdateIntegratedBitsKickCoinsGiveawayDto extends PartialType(
  CreateIntegratedBitsKickCoinsGiveawayDto,
) {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Weekly Bits & Kick Coins Giveaway',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}






