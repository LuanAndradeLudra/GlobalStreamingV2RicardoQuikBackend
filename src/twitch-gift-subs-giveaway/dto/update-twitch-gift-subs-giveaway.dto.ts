import { PartialType } from '@nestjs/swagger';
import { CreateTwitchGiftSubsGiveawayDto } from './create-twitch-gift-subs-giveaway.dto';

export class UpdateTwitchGiftSubsGiveawayDto extends PartialType(CreateTwitchGiftSubsGiveawayDto) {}


