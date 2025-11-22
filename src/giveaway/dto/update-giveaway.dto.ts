import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { CreateGiveawayDto } from './create-giveaway.dto';

export class UpdateGiveawayDto extends PartialType(CreateGiveawayDto) {}

