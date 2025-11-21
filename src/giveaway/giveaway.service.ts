import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGiveawayDto } from './dto/create-giveaway.dto';
import { UpdateGiveawayDto } from './dto/update-giveaway.dto';
import { Giveaway, GiveawayStatus, ConnectedPlatform } from '@prisma/client';

@Injectable()
export class GiveawayService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new giveaway for the authenticated admin user.
   * Business rule: If status is OPEN, automatically close any existing OPEN giveaway for this user.
   */
  async create(userId: string, dto: CreateGiveawayDto): Promise<Giveaway> {
    const status = dto.status || GiveawayStatus.DRAFT;

    // If creating with OPEN status, ensure only one OPEN giveaway exists per admin
    if (status === GiveawayStatus.OPEN) {
      await this.ensureOnlyOneOpenGiveaway(userId);
    }

    return this.prisma.giveaway.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        status,
        platforms: dto.platforms,
        keyword: dto.keyword,
      },
    });
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
    });

    if (!giveaway) {
      throw new NotFoundException(`Giveaway with ID ${id} not found`);
    }

    return giveaway;
  }

  /**
   * Update a giveaway.
   * Business rule: If status is being changed to OPEN, automatically close any existing OPEN giveaway for this user.
   */
  async update(userId: string, id: string, dto: UpdateGiveawayDto): Promise<Giveaway> {
    // Ensure the giveaway exists and belongs to the user
    await this.findOne(userId, id);

    // If updating status to OPEN, ensure only one OPEN giveaway exists per admin
    if (dto.status === GiveawayStatus.OPEN) {
      await this.ensureOnlyOneOpenGiveaway(userId, id);
    }

    return this.prisma.giveaway.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.platforms !== undefined && { platforms: dto.platforms }),
        ...(dto.keyword !== undefined && { keyword: dto.keyword }),
      },
    });
  }

  /**
   * Business rule: Ensure only one OPEN giveaway exists per admin user.
   * Strategy: Automatically close any existing OPEN giveaway (except the current one if updating).
   * This allows seamless transitions between giveaways without manual intervention.
   */
  private async ensureOnlyOneOpenGiveaway(userId: string, excludeId?: string): Promise<void> {
    const whereClause: any = {
      userId,
      status: GiveawayStatus.OPEN,
      ...(excludeId && { id: { not: excludeId } }),
    };

    const existingOpenGiveaways = await this.prisma.giveaway.findMany({
      where: whereClause,
    });

    if (existingOpenGiveaways.length > 0) {
      // Automatically close all existing OPEN giveaways
      await this.prisma.giveaway.updateMany({
        where: whereClause,
        data: {
          status: GiveawayStatus.CLOSED,
        },
      });
    }
  }

  /**
   * Compute tickets for a participant based on giveaway rules and ticket configuration.
   * 
   * This method will use:
   * 1. GiveawayTicketRuleOverride if exists (giveaway-specific overrides)
   * 2. TicketGlobalRule (default rules for the user)
   * 3. TicketGlobalDonationRule for donation-based tickets
   * 
   * TODO: Implement full logic using TicketConfig + overrides
   * For now, returns a simple placeholder implementation.
   */
  async computeTicketsForParticipant(
    giveawayId: string,
    platform: ConnectedPlatform,
    participantData: {
      isSub: boolean;
      subTier?: number;
      isGiftSubDonor: boolean;
      donationAmount?: number;
    },
  ): Promise<number> {
    // TODO: Implement full ticket computation logic
    // 1. Check for GiveawayTicketRuleOverride for this giveaway + platform + role
    // 2. If not found, use TicketGlobalRule for the giveaway owner + platform + role
    // 3. For donations, use TicketGlobalDonationRule to convert donation amount to tickets
    // 4. Combine all sources to compute total tickets
    
    // Placeholder: simple implementation
    let tickets = 0;

    if (participantData.isSub) {
      // Basic subscription ticket (will be replaced with proper rule lookup)
      tickets += 1;
    }

    if (participantData.isGiftSubDonor) {
      // Gift sub donor ticket (will be replaced with proper rule lookup)
      tickets += 1;
    }

    if (participantData.donationAmount && participantData.donationAmount > 0) {
      // Basic donation ticket calculation (will be replaced with proper rule lookup)
      // This is a placeholder - actual implementation will use TicketGlobalDonationRule
      tickets += Math.floor(participantData.donationAmount / 100);
    }

    return tickets;
  }
}

