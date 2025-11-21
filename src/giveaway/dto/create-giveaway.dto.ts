import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsArray, IsOptional, ArrayMinSize, IsBoolean, ValidateIf } from 'class-validator';
import { GiveawayType, ConnectedPlatform, DonationWindow } from '@prisma/client';
import { CreateGiveawayTicketRuleOverrideDto } from './create-giveaway-ticket-rule-override.dto';

export class CreateGiveawayDto {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Summer Giveaway 2024',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Type of giveaway',
    enum: GiveawayType,
    example: GiveawayType.LIVE_KEYWORD,
  })
  @IsEnum(GiveawayType)
  type: GiveawayType;

  @ApiProperty({
    description: 'Platforms where the giveaway will run',
    enum: ConnectedPlatform,
    isArray: true,
    example: [ConnectedPlatform.TWITCH, ConnectedPlatform.KICK],
  })
  @IsArray()
  @IsEnum(ConnectedPlatform, { each: true })
  @ArrayMinSize(1)
  platforms: ConnectedPlatform[];

  @ApiProperty({
    description: 'Keyword for LIVE_KEYWORD type giveaways (required if type is LIVE_KEYWORD)',
    example: '!enter',
    required: false,
  })
  @ValidateIf((o) => o.type === GiveawayType.LIVE_KEYWORD)
  @IsString()
  keyword?: string;

  @ApiProperty({
    description: 'Initial status of the giveaway (defaults to DRAFT if not provided)',
    enum: ['DRAFT', 'OPEN'],
    example: 'DRAFT',
    required: false,
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'OPEN'])
  status?: 'DRAFT' | 'OPEN';

  @ApiProperty({
    description: 'Include bits donors in ticket calculation',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeBitsDonors?: boolean;

  @ApiProperty({
    description: 'Include gift sub donors in ticket calculation',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeGiftSubDonors?: boolean;

  @ApiProperty({
    description: 'Time window for bits donations (required if includeBitsDonors is true)',
    enum: DonationWindow,
    example: DonationWindow.DAILY,
    required: false,
  })
  @ValidateIf((o) => o.includeBitsDonors === true)
  @IsOptional()
  @IsEnum(DonationWindow)
  bitsDonationWindow?: DonationWindow;

  @ApiProperty({
    description: 'Time window for gift sub donations (required if includeGiftSubDonors is true)',
    enum: DonationWindow,
    example: DonationWindow.WEEKLY,
    required: false,
  })
  @ValidateIf((o) => o.includeGiftSubDonors === true)
  @IsOptional()
  @IsEnum(DonationWindow)
  giftSubDonationWindow?: DonationWindow;

  @ApiProperty({
    description: 'Optional ticket rule overrides for this giveaway',
    type: [CreateGiveawayTicketRuleOverrideDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  ticketRuleOverrides?: CreateGiveawayTicketRuleOverrideDto[];
}

