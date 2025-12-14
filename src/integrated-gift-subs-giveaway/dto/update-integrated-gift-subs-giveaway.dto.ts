import { PartialType } from '@nestjs/swagger';
import { CreateIntegratedGiftSubsGiveawayDto } from './create-integrated-gift-subs-giveaway.dto';

export class UpdateIntegratedGiftSubsGiveawayDto extends PartialType(CreateIntegratedGiftSubsGiveawayDto) {}

