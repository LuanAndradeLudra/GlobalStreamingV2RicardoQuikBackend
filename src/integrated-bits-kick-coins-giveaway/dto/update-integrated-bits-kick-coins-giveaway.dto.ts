import { PartialType } from '@nestjs/swagger';
import { CreateIntegratedBitsKickCoinsGiveawayDto } from './create-integrated-bits-kick-coins-giveaway.dto';

export class UpdateIntegratedBitsKickCoinsGiveawayDto extends PartialType(
  CreateIntegratedBitsKickCoinsGiveawayDto,
) {}
