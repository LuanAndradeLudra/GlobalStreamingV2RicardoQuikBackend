import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGiveawayDto } from './dto/create-giveaway.dto';
import { UpdateGiveawayDto } from './dto/update-giveaway.dto';
import { Giveaway, GiveawayStatus, GiveawayType, ConnectedPlatform } from '@prisma/client';
import { CreateGiveawayTicketRuleOverrideDto } from './dto/create-giveaway-ticket-rule-override.dto';

@Injectable()
export class GiveawayService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new giveaway for the authenticated admin user.
   * Business rule: Only one OPEN giveaway per admin. Returns error if trying to create OPEN when one already exists.
   */
  async create(userId: string, dto: CreateGiveawayDto): Promise<Giveaway> {
    const status = dto.status || GiveawayStatus.DRAFT;

    // Validate keyword is required for LIVE_KEYWORD type
    if (dto.type === GiveawayType.LIVE_KEYWORD && !dto.keyword) {
      throw new BadRequestException('Keyword is required for LIVE_KEYWORD type giveaways');
    }

    // Validate donation windows are provided when flags are true
    if (dto.includeBitsDonors && !dto.bitsDonationWindow) {
      throw new BadRequestException('bitsDonationWindow is required when includeBitsDonors is true');
    }
    if (dto.includeGiftSubDonors && !dto.giftSubDonationWindow) {
      throw new BadRequestException('giftSubDonationWindow is required when includeGiftSubDonors is true');
    }

    // If creating with OPEN status, check if another OPEN giveaway exists
    if (status === GiveawayStatus.OPEN) {
      await this.checkOnlyOneOpenGiveaway(userId);
    }

    // Create giveaway with ticket rule overrides if provided
    const giveaway = await this.prisma.giveaway.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        status,
        platforms: dto.platforms,
        keyword: dto.keyword,
        includeBitsDonors: dto.includeBitsDonors ?? false,
        includeGiftSubDonors: dto.includeGiftSubDonors ?? false,
        bitsDonationWindow: dto.bitsDonationWindow,
        giftSubDonationWindow: dto.giftSubDonationWindow,
        ticketRuleOverrides: dto.ticketRuleOverrides
          ? {
              create: dto.ticketRuleOverrides.map((override) => ({
                role: override.role,
                ticketsPerUnit: override.ticketsPerUnit,
              })),
            }
          : undefined,
      },
      include: {
        ticketRuleOverrides: true,
      },
    });

    return giveaway;
  }

  /**
   * Get all giveaways for the authenticated admin user.
   */
  async findAll(userId: string): Promise<Giveaway[]> {
    return this.prisma.giveaway.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific giveaway by ID, ensuring it belongs to the authenticated admin user.
   */
  async findOne(userId: string, id: string): Promise<Giveaway> {
    const giveaway = await this.prisma.giveaway.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        ticketRuleOverrides: true,
      },
    });

    if (!giveaway) {
      throw new NotFoundException(`Giveaway with ID ${id} not found`);
    }

    return giveaway;
  }

  /**
   * Update a giveaway.
   * Business rule: Only one OPEN giveaway per admin. Returns error if trying to set OPEN when another already exists.
   */
  async update(userId: string, id: string, dto: UpdateGiveawayDto): Promise<Giveaway> {
    // Ensure the giveaway exists and belongs to the user
    const existingGiveaway = await this.findOne(userId, id);

    // Validate keyword is required if type is being changed to LIVE_KEYWORD
    if (dto.type === GiveawayType.LIVE_KEYWORD && !dto.keyword && !existingGiveaway.keyword) {
      throw new BadRequestException('Keyword is required for LIVE_KEYWORD type giveaways');
    }

    // Validate donation windows when flags are being set
    const includeBitsDonors = dto.includeBitsDonors ?? existingGiveaway.includeBitsDonors;
    const includeGiftSubDonors = dto.includeGiftSubDonors ?? existingGiveaway.includeGiftSubDonors;

    if (includeBitsDonors && !dto.bitsDonationWindow && !existingGiveaway.bitsDonationWindow) {
      throw new BadRequestException('bitsDonationWindow is required when includeBitsDonors is true');
    }
    if (includeGiftSubDonors && !dto.giftSubDonationWindow && !existingGiveaway.giftSubDonationWindow) {
      throw new BadRequestException('giftSubDonationWindow is required when includeGiftSubDonors is true');
    }

    // If updating status to OPEN, check if another OPEN giveaway exists
    if (dto.status === GiveawayStatus.OPEN) {
      await this.checkOnlyOneOpenGiveaway(userId, id);
    }

    return this.prisma.giveaway.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.platforms !== undefined && { platforms: dto.platforms }),
        ...(dto.keyword !== undefined && { keyword: dto.keyword }),
        ...(dto.includeBitsDonors !== undefined && { includeBitsDonors: dto.includeBitsDonors }),
        ...(dto.includeGiftSubDonors !== undefined && { includeGiftSubDonors: dto.includeGiftSubDonors }),
        ...(dto.bitsDonationWindow !== undefined && { bitsDonationWindow: dto.bitsDonationWindow }),
        ...(dto.giftSubDonationWindow !== undefined && { giftSubDonationWindow: dto.giftSubDonationWindow }),
      },
    });
  }

  /**
   * Business rule: Ensure only one OPEN giveaway exists per admin user.
   * Strategy: Return error if trying to create/update to OPEN when another OPEN giveaway already exists.
   */
  private async checkOnlyOneOpenGiveaway(userId: string, excludeId?: string): Promise<void> {
    const whereClause: any = {
      userId,
      status: GiveawayStatus.OPEN,
      ...(excludeId && { id: { not: excludeId } }),
    };

    const existingOpenGiveaway = await this.prisma.giveaway.findFirst({
      where: whereClause,
    });

    if (existingOpenGiveaway) {
      throw new BadRequestException(
        `You already have an open giveaway (${existingOpenGiveaway.name}). Only one giveaway can be OPEN at a time. Please close it first.`
      );
    }
  }

  /**
   * Calculate tickets for a participant based on giveaway rules and ticket configuration.
   * 
   * This method uses:
   * 1. GiveawayTicketRuleOverride if exists (giveaway-specific overrides)
   * 2. TicketGlobalRule (default rules for the admin user)
   * 3. TicketGlobalDonationRule for donation-based tickets (BITS and GIFT_SUB)
   * 
   * Note: The donation window (bitsDonationWindow/giftSubDonationWindow) is ignored for now.
   * This will be used when integrating with the actual source of bits/gifts data.
   */
  async calculateTicketsForParticipant(input: {
    giveawayId: string;
    platform: ConnectedPlatform;
    adminUserId: string;
    role: string; // NON_SUB, TWITCH_TIER_1, TWITCH_TIER_2, TWITCH_TIER_3, KICK_SUB, YOUTUBE_SUB
    totalBits?: number; // total de bits válidos para esse sorteio
    totalGiftSubs?: number; // total de gift subs válidos para esse sorteio
  }): Promise<{
    baseTickets: number;
    bitsTickets: number;
    giftTickets: number;
    totalTickets: number;
  }> {
    // Get giveaway to check donation flags
    const giveaway = await this.findOne(input.adminUserId, input.giveawayId);

    // 1. Calculate base tickets from role (check override first, then global rule)
    let baseTickets = 0;

    // Check for giveaway-specific override
    const override = await this.prisma.giveawayTicketRuleOverride.findUnique({
      where: {
        giveawayId_role: {
          giveawayId: input.giveawayId,
          role: input.role,
        },
      },
    });

    if (override) {
      baseTickets = override.ticketsPerUnit;
    } else {
      // Use global rule
      const globalRule = await this.prisma.ticketGlobalRule.findUnique({
        where: {
          userId_role: {
            userId: input.adminUserId,
            role: input.role,
          },
        },
      });

      if (globalRule) {
        baseTickets = globalRule.ticketsPerUnit;
      }
    }

    // 2. Calculate bits tickets (if enabled)
    let bitsTickets = 0;
    // TODO: Use bitsDonationWindow when integrating with actual bits data source
    if (giveaway.includeBitsDonors && input.totalBits && input.totalBits > 0) {
      const bitsRule = await this.prisma.ticketGlobalDonationRule.findUnique({
        where: {
          userId_platform_unitType: {
            userId: input.adminUserId,
            platform: input.platform,
            unitType: 'BITS',
          },
        },
      });

      if (bitsRule) {
        // Calculate tickets: (totalBits / unitSize) * ticketsPerUnitSize
        bitsTickets = Math.floor((input.totalBits / bitsRule.unitSize) * bitsRule.ticketsPerUnitSize);
      }
    }

    // 3. Calculate gift sub tickets (if enabled)
    let giftTickets = 0;
    // TODO: Use giftSubDonationWindow when integrating with actual gift subs data source
    if (giveaway.includeGiftSubDonors && input.totalGiftSubs && input.totalGiftSubs > 0) {
      const giftRule = await this.prisma.ticketGlobalDonationRule.findUnique({
        where: {
          userId_platform_unitType: {
            userId: input.adminUserId,
            platform: input.platform,
            unitType: 'GIFT_SUB',
          },
        },
      });

      if (giftRule) {
        // Calculate tickets: (totalGiftSubs / unitSize) * ticketsPerUnitSize
        giftTickets = Math.floor((input.totalGiftSubs / giftRule.unitSize) * giftRule.ticketsPerUnitSize);
      }
    }

    // For now, return only baseTickets as total (bits and gift tickets are calculated but not included)
    // TODO: Include bitsTickets and giftTickets in totalTickets when donation windows are properly integrated
    const totalTickets = baseTickets;

    return {
      baseTickets,
      bitsTickets,
      giftTickets,
      totalTickets,
    };
  }
}

