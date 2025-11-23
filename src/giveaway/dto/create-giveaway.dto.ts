import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsArray, IsOptional, ArrayMinSize, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ConnectedPlatform } from '@prisma/client';
import { CreateGiveawayTicketRuleOverrideDto } from './create-giveaway-ticket-rule-override.dto';
import { CreateGiveawayDonationRuleOverrideDto } from './create-giveaway-donation-rule-override.dto';
import { CreateGiveawayDonationConfigDto } from './create-giveaway-donation-config.dto';

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

  // Step 5: Donations configuration (pivot table)
  @ApiProperty({
    description: 'Donation configurations for this giveaway (platform-specific)',
    type: [CreateGiveawayDonationConfigDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGiveawayDonationConfigDto)
  donationConfigs?: CreateGiveawayDonationConfigDto[];

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

