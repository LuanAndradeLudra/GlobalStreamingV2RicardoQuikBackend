import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsArray, IsOptional, ArrayMinSize, IsBoolean, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ConnectedPlatform, DonationWindow } from '@prisma/client';
import { CreateGiveawayTicketRuleOverrideDto } from './create-giveaway-ticket-rule-override.dto';
import { CreateGiveawayDonationRuleOverrideDto } from './create-giveaway-donation-rule-override.dto';

export class CreateGiveawayDto {
  @ApiProperty({
    description: 'Name of the giveaway',
    example: 'Summer Giveaway 2024',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of the giveaway',
    example: 'A summer giveaway for all subscribers',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

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
    description: 'Platforms where the giveaway will run (stream platforms only: TWITCH, KICK, YOUTUBE)',
    enum: ConnectedPlatform,
    isArray: true,
    example: [ConnectedPlatform.TWITCH, ConnectedPlatform.KICK],
  })
  @IsArray()
  @IsEnum(ConnectedPlatform, { each: true })
  @ArrayMinSize(1)
  platforms: ConnectedPlatform[];

  @ApiProperty({
    description: 'Keyword for the giveaway (required for all STREAM giveaways)',
    example: '!enter',
  })
  @IsString()
  keyword: string;

  // Step 2: Roles allowed
  @ApiProperty({
    description: 'Shortcut: if true, expands to all subscription roles for selected platforms',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  subsOnly?: boolean;

  @ApiProperty({
    description: 'Shortcut: if true, sets allowedRoles to ["NON_SUB"]',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  nonSubsOnly?: boolean;

  @ApiProperty({
    description: 'Array of allowed roles (e.g., ["NON_SUB", "TWITCH_TIER_1", "KICK_SUB"])',
    type: [String],
    example: ['NON_SUB', 'TWITCH_TIER_1'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRoles?: string[];

  // Step 3: Ticket rule overrides
  @ApiProperty({
    description: 'Optional ticket rule overrides for this giveaway',
    type: [CreateGiveawayTicketRuleOverrideDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGiveawayTicketRuleOverrideDto)
  ticketRuleOverrides?: CreateGiveawayTicketRuleOverrideDto[];

  // Step 4: Donations
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
    description: 'Include coins donors (e.g., KICK_COINS) in ticket calculation',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeCoinsDonors?: boolean;

  @ApiProperty({
    description: 'Include superchat donors in ticket calculation',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeSuperchatDonors?: boolean;

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
    description: 'Time window for coins donations (required if includeCoinsDonors is true)',
    enum: DonationWindow,
    example: DonationWindow.DAILY,
    required: false,
  })
  @ValidateIf((o) => o.includeCoinsDonors === true)
  @IsOptional()
  @IsEnum(DonationWindow)
  coinsDonationWindow?: DonationWindow;

  @ApiProperty({
    description: 'Time window for superchat donations (required if includeSuperchatDonors is true)',
    enum: DonationWindow,
    example: DonationWindow.DAILY,
    required: false,
  })
  @ValidateIf((o) => o.includeSuperchatDonors === true)
  @IsOptional()
  @IsEnum(DonationWindow)
  superchatDonationWindow?: DonationWindow;

  // Step 4: Donation rule overrides
  @ApiProperty({
    description: 'Optional donation rule overrides for this giveaway',
    type: [CreateGiveawayDonationRuleOverrideDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGiveawayDonationRuleOverrideDto)
  donationRuleOverrides?: CreateGiveawayDonationRuleOverrideDto[];
}

