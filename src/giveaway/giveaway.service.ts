import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGiveawayDto } from './dto/create-giveaway.dto';
import { UpdateGiveawayDto } from './dto/update-giveaway.dto';
import { Giveaway, GiveawayStatus, ConnectedPlatform } from '@prisma/client';
import { CreateGiveawayTicketRuleOverrideDto } from './dto/create-giveaway-ticket-rule-override.dto';
import { CreateGiveawayDonationRuleOverrideDto } from './dto/create-giveaway-donation-rule-override.dto';
import { CreateGiveawayDonationConfigDto } from './dto/create-giveaway-donation-config.dto';

@Injectable()
export class GiveawayService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the universe of valid roles for given platforms.
   * NON_SUB is now platform-specific: TWITCH_NON_SUB, KICK_NON_SUB, YOUTUBE_NON_SUB.
   * Adds platform-specific subscription roles based on platforms.
   */
  getRoleUniverseForPlatforms(platforms: ConnectedPlatform[]): string[] {
    const roles: string[] = [];

    // Add platform-specific NON_SUB roles
    if (platforms.includes(ConnectedPlatform.TWITCH)) {
      roles.push('TWITCH_NON_SUB', 'TWITCH_TIER_1', 'TWITCH_TIER_2', 'TWITCH_TIER_3');
    }
    if (platforms.includes(ConnectedPlatform.KICK)) {
      roles.push('KICK_NON_SUB', 'KICK_SUB');
    }
    if (platforms.includes(ConnectedPlatform.YOUTUBE)) {
      roles.push('YOUTUBE_NON_SUB', 'YOUTUBE_SUB');
    }

    return roles;
  }

  /**
   * Normalize allowedRoles based on shortcuts and platforms.
   * - If subsOnly: expand to all subscription roles for selected platforms
   * - If nonSubsOnly: set to ["NON_SUB"]
   * - Otherwise: validate against role universe
   */
  normalizeAllowedRoles(
    input: {
      subsOnly?: boolean;
      nonSubsOnly?: boolean;
      allowedRoles?: string[];
      platforms: ConnectedPlatform[];
    },
  ): string[] {
    const { subsOnly, nonSubsOnly, allowedRoles, platforms } = input;

    if (nonSubsOnly) {
      // Return platform-specific NON_SUB roles
      const roles: string[] = [];
      if (platforms.includes(ConnectedPlatform.TWITCH)) {
        roles.push('TWITCH_NON_SUB');
      }
      if (platforms.includes(ConnectedPlatform.KICK)) {
        roles.push('KICK_NON_SUB');
      }
      if (platforms.includes(ConnectedPlatform.YOUTUBE)) {
        roles.push('YOUTUBE_NON_SUB');
      }
      return roles;
    }

    if (subsOnly) {
      const universe = this.getRoleUniverseForPlatforms(platforms);
      // Return all roles except NON_SUB variants
      return universe.filter((role) => !role.includes('NON_SUB'));
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const universe = this.getRoleUniverseForPlatforms(platforms);
      // Validate that all provided roles are in the universe
      const invalidRoles = allowedRoles.filter((role) => !universe.includes(role));
      if (invalidRoles.length > 0) {
        throw new BadRequestException(
          `Invalid roles for selected platforms: ${invalidRoles.join(', ')}. Valid roles: ${universe.join(', ')}`,
        );
      }
      return allowedRoles;
    }

    // Default: allow all roles
    return this.getRoleUniverseForPlatforms(platforms);
  }

  /**
   * Validate platforms are stream platforms only (TWITCH, KICK, YOUTUBE).
   */
  validatePlatforms(platforms: ConnectedPlatform[]): void {
    const streamPlatforms: ConnectedPlatform[] = [ConnectedPlatform.TWITCH, ConnectedPlatform.KICK, ConnectedPlatform.YOUTUBE];
    const invalidPlatforms = platforms.filter((p) => !streamPlatforms.includes(p));
    if (invalidPlatforms.length > 0) {
      throw new BadRequestException(
        `Invalid platforms: ${invalidPlatforms.join(', ')}. Only stream platforms are allowed: TWITCH, KICK, YOUTUBE`,
      );
    }
  }

  /**
   * Upsert ticket rule overrides for a giveaway.
   * Removes existing overrides not in the new list, creates/updates the ones provided.
   */
  async upsertTicketOverrides(
    giveawayId: string,
    overrides: CreateGiveawayTicketRuleOverrideDto[] | undefined,
  ): Promise<void> {
    if (!overrides) {
      return;
    }

    // Get existing overrides
    const existing = await this.prisma.giveawayTicketRuleOverride.findMany({
      where: { giveawayId },
    });

    const existingRoles = new Set(existing.map((o) => o.role));
    const newRoles = new Set(overrides.map((o) => o.role));

    // Delete overrides that are no longer in the list
    const toDelete = existing.filter((o) => !newRoles.has(o.role));
    if (toDelete.length > 0) {
      await this.prisma.giveawayTicketRuleOverride.deleteMany({
        where: {
          giveawayId,
          role: { in: toDelete.map((o) => o.role) },
        },
      });
    }

    // Upsert the new/updated overrides
    await Promise.all(
      overrides.map((override) =>
        this.prisma.giveawayTicketRuleOverride.upsert({
          where: {
            giveawayId_role: {
              giveawayId,
              role: override.role,
            },
          },
          update: {
            ticketsPerUnit: override.ticketsPerUnit,
          },
          create: {
            giveawayId,
            role: override.role,
            ticketsPerUnit: override.ticketsPerUnit,
          },
        }),
      ),
    );
  }

  /**
   * Upsert donation configs for a giveaway.
   * Removes existing configs not in the new list, creates/updates the ones provided.
   */
  async upsertDonationConfigs(
    giveawayId: string,
    configs: CreateGiveawayDonationConfigDto[] | undefined,
  ): Promise<void> {
    if (!configs) {
      return;
    }

    // Get existing configs
    const existing = await this.prisma.giveawayDonationConfig.findMany({
      where: { giveawayId },
    });

    const existingKeys = new Set(
      existing.map((c) => `${c.platform}:${c.unitType}`),
    );
    const newKeys = new Set(
      configs.map((c) => `${c.platform}:${c.unitType}`),
    );

    // Delete configs that are no longer in the list
    const toDelete = existing.filter(
      (c) => !newKeys.has(`${c.platform}:${c.unitType}`),
    );
    if (toDelete.length > 0) {
      await this.prisma.giveawayDonationConfig.deleteMany({
        where: {
          giveawayId,
          id: { in: toDelete.map((c) => c.id) },
        },
      });
    }

    // Upsert the new/updated configs
    await Promise.all(
      configs.map((config) =>
        this.prisma.giveawayDonationConfig.upsert({
          where: {
            giveawayId_platform_unitType: {
              giveawayId,
              platform: config.platform,
              unitType: config.unitType,
            },
          },
          update: {
            donationWindow: config.donationWindow,
          },
          create: {
            giveawayId,
            platform: config.platform,
            unitType: config.unitType,
            donationWindow: config.donationWindow,
          },
        }),
      ),
    );
  }

  /**
   * Upsert donation rule overrides for a giveaway.
   * Removes existing overrides not in the new list, creates/updates the ones provided.
   */
  async upsertDonationOverrides(
    giveawayId: string,
    overrides: CreateGiveawayDonationRuleOverrideDto[] | undefined,
  ): Promise<void> {
    if (!overrides) {
      return;
    }

    // Get existing overrides
    const existing = await this.prisma.giveawayDonationRuleOverride.findMany({
      where: { giveawayId },
    });

    const existingKeys = new Set(
      existing.map((o: { platform: ConnectedPlatform; unitType: string }) => `${o.platform}:${o.unitType}`),
    );
    const newKeys = new Set(
      overrides.map((o) => `${o.platform}:${o.unitType}`),
    );

    // Delete overrides that are no longer in the list
    const toDelete = existing.filter(
      (o: { platform: ConnectedPlatform; unitType: string }) => !newKeys.has(`${o.platform}:${o.unitType}`),
    );
    if (toDelete.length > 0) {
      await Promise.all(
        toDelete.map((o: { giveawayId: string; platform: ConnectedPlatform; unitType: string }) =>
          this.prisma.giveawayDonationRuleOverride.delete({
            where: {
              giveawayId_platform_unitType: {
                giveawayId: o.giveawayId,
                platform: o.platform,
                unitType: o.unitType,
              },
            },
          }),
        ),
      );
    }

    // Upsert the new/updated overrides
    await Promise.all(
      overrides.map((override) =>
        this.prisma.giveawayDonationRuleOverride.upsert({
          where: {
            giveawayId_platform_unitType: {
              giveawayId,
              platform: override.platform,
              unitType: override.unitType,
            },
          },
          update: {
            unitSize: override.unitSize,
            ticketsPerUnitSize: override.ticketsPerUnitSize,
          },
          create: {
            giveawayId,
            platform: override.platform,
            unitType: override.unitType,
            unitSize: override.unitSize,
            ticketsPerUnitSize: override.ticketsPerUnitSize,
          },
        }),
      ),
    );
  }

  /**
   * Create a new giveaway for the authenticated admin user.
   * Business rule: Only one OPEN giveaway per admin. Returns error if trying to create OPEN when one already exists.
   */
  async create(userId: string, dto: CreateGiveawayDto): Promise<Giveaway> {
    const status = dto.status || GiveawayStatus.DRAFT;

    // Validate platforms are stream platforms only
    this.validatePlatforms(dto.platforms);

    // Validate keyword is required and not empty
    if (!dto.keyword || dto.keyword.trim().length === 0) {
      throw new BadRequestException('Keyword is required for all giveaways');
    }

    // Normalize allowedRoles
    const allowedRoles = this.normalizeAllowedRoles({
      subsOnly: dto.subsOnly,
      nonSubsOnly: dto.nonSubsOnly,
      allowedRoles: dto.allowedRoles,
      platforms: dto.platforms,
    });

    // If creating with OPEN status, check if another OPEN giveaway exists
    if (status === GiveawayStatus.OPEN) {
      await this.checkOnlyOneOpenGiveaway(userId);
    }

    // Create giveaway with overrides in a transaction
    const giveaway = await this.prisma.$transaction(async (tx) => {
      const created = await tx.giveaway.create({
        data: {
          userId,
          name: dto.name,
          description: dto.description,
          status,
          platforms: dto.platforms,
          keyword: dto.keyword,
          allowedRoles,
        },
      });

      // Create ticket rule overrides if provided
      if (dto.ticketRuleOverrides && dto.ticketRuleOverrides.length > 0) {
        await tx.giveawayTicketRuleOverride.createMany({
          data: dto.ticketRuleOverrides.map((override) => ({
            giveawayId: created.id,
            role: override.role,
            ticketsPerUnit: override.ticketsPerUnit,
          })),
        });
      }

      // Create donation configs if provided
      if (dto.donationConfigs && dto.donationConfigs.length > 0) {
        await tx.giveawayDonationConfig.createMany({
          data: dto.donationConfigs.map((config) => ({
            giveawayId: created.id,
            platform: config.platform,
            unitType: config.unitType,
            donationWindow: config.donationWindow,
          })),
        });
      }

      // Create donation rule overrides if provided
      if (dto.donationRuleOverrides && dto.donationRuleOverrides.length > 0) {
        await tx.giveawayDonationRuleOverride.createMany({
          data: dto.donationRuleOverrides.map((override) => ({
            giveawayId: created.id,
            platform: override.platform,
            unitType: override.unitType,
            unitSize: override.unitSize,
            ticketsPerUnitSize: override.ticketsPerUnitSize,
          })),
        });
      }

      return created;
    });

    // Fetch with relations
    return this.findOne(userId, giveaway.id);
  }

  /**
   * Get all giveaways for the authenticated admin user.
   */
  async findAll(userId: string): Promise<Giveaway[]> {
    return this.prisma.giveaway.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        ticketRuleOverrides: true,
        donationRuleOverrides: true,
        donationConfigs: true,
      },
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
        donationRuleOverrides: true,
        donationConfigs: true,
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

    // Validate platforms if being updated
    const platforms = dto.platforms ?? (existingGiveaway.platforms as ConnectedPlatform[]);
    if (dto.platforms) {
      this.validatePlatforms(dto.platforms);
    }

    // Validate keyword is required and not empty
    const keyword = dto.keyword ?? existingGiveaway.keyword;
    if (!keyword || keyword.trim().length === 0) {
      throw new BadRequestException('Keyword is required for all giveaways');
    }

    // Normalize allowedRoles if any role-related fields are being updated
    let allowedRoles = existingGiveaway.allowedRoles as string[];
    if (dto.subsOnly !== undefined || dto.nonSubsOnly !== undefined || dto.allowedRoles !== undefined) {
      allowedRoles = this.normalizeAllowedRoles({
        subsOnly: dto.subsOnly,
        nonSubsOnly: dto.nonSubsOnly,
        allowedRoles: dto.allowedRoles,
        platforms,
      });
    }

    // If updating status to OPEN, check if another OPEN giveaway exists
    if (dto.status === GiveawayStatus.OPEN) {
      await this.checkOnlyOneOpenGiveaway(userId, id);
    }

    // Update giveaway and overrides in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.giveaway.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.platforms !== undefined && { platforms: dto.platforms }),
          ...(dto.keyword !== undefined && { keyword: dto.keyword }),
          ...(allowedRoles !== undefined && { allowedRoles }),
        },
      });

      // Upsert ticket rule overrides if provided
      if (dto.ticketRuleOverrides !== undefined) {
        // Get existing overrides
        const existing = await tx.giveawayTicketRuleOverride.findMany({
          where: { giveawayId: id },
        });

        const existingRoles = new Set(existing.map((o) => o.role));
        const newRoles = new Set(dto.ticketRuleOverrides.map((o) => o.role));

        // Delete overrides that are no longer in the list
        const toDelete = existing.filter((o) => !newRoles.has(o.role));
        if (toDelete.length > 0) {
          await tx.giveawayTicketRuleOverride.deleteMany({
            where: {
              giveawayId: id,
              role: { in: toDelete.map((o) => o.role) },
            },
          });
        }

        // Upsert the new/updated overrides
        await Promise.all(
          dto.ticketRuleOverrides.map((override) =>
            tx.giveawayTicketRuleOverride.upsert({
              where: {
                giveawayId_role: {
                  giveawayId: id,
                  role: override.role,
                },
              },
              update: {
                ticketsPerUnit: override.ticketsPerUnit,
              },
              create: {
                giveawayId: id,
                role: override.role,
                ticketsPerUnit: override.ticketsPerUnit,
              },
            }),
          ),
        );
      }

      // Upsert donation configs if provided
      if (dto.donationConfigs !== undefined) {
        // Get existing configs
        const existing = await tx.giveawayDonationConfig.findMany({
          where: { giveawayId: id },
        });

        const existingKeys = new Set(
          existing.map((c) => `${c.platform}:${c.unitType}`),
        );
        const newKeys = new Set(
          dto.donationConfigs.map((c) => `${c.platform}:${c.unitType}`),
        );

        // Delete configs that are no longer in the list
        const toDelete = existing.filter(
          (c) => !newKeys.has(`${c.platform}:${c.unitType}`),
        );
        if (toDelete.length > 0) {
          await tx.giveawayDonationConfig.deleteMany({
            where: {
              giveawayId: id,
              id: { in: toDelete.map((c) => c.id) },
            },
          });
        }

        // Upsert the new/updated configs
        await Promise.all(
          dto.donationConfigs.map((config) =>
            tx.giveawayDonationConfig.upsert({
              where: {
                giveawayId_platform_unitType: {
                  giveawayId: id,
                  platform: config.platform,
                  unitType: config.unitType,
                },
              },
              update: {
                donationWindow: config.donationWindow,
              },
              create: {
                giveawayId: id,
                platform: config.platform,
                unitType: config.unitType,
                donationWindow: config.donationWindow,
              },
            }),
          ),
        );
      }

      // Upsert donation rule overrides if provided
      if (dto.donationRuleOverrides !== undefined) {
        // Get existing overrides
        const existing = await tx.giveawayDonationRuleOverride.findMany({
          where: { giveawayId: id },
        });

        const existingKeys = new Set(
          existing.map((o: { platform: ConnectedPlatform; unitType: string }) => `${o.platform}:${o.unitType}`),
        );
        const newKeys = new Set(
          dto.donationRuleOverrides.map((o) => `${o.platform}:${o.unitType}`),
        );

        // Delete overrides that are no longer in the list
        const toDelete = existing.filter(
          (o: { platform: ConnectedPlatform; unitType: string }) => !newKeys.has(`${o.platform}:${o.unitType}`),
        );
        if (toDelete.length > 0) {
          await Promise.all(
            toDelete.map((o: { giveawayId: string; platform: ConnectedPlatform; unitType: string }) =>
              tx.giveawayDonationRuleOverride.delete({
                where: {
                  giveawayId_platform_unitType: {
                    giveawayId: o.giveawayId,
                    platform: o.platform,
                    unitType: o.unitType,
                  },
                },
              }),
            ),
          );
        }

        // Upsert the new/updated overrides
        await Promise.all(
          dto.donationRuleOverrides.map((override) =>
            tx.giveawayDonationRuleOverride.upsert({
              where: {
                giveawayId_platform_unitType: {
                  giveawayId: id,
                  platform: override.platform,
                  unitType: override.unitType,
                },
              },
              update: {
                unitSize: override.unitSize,
                ticketsPerUnitSize: override.ticketsPerUnitSize,
              },
              create: {
                giveawayId: id,
                platform: override.platform,
                unitType: override.unitType,
                unitSize: override.unitSize,
                ticketsPerUnitSize: override.ticketsPerUnitSize,
              },
            }),
          ),
        );
      }
    });

    return this.findOne(userId, id);
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
        `You already have an open giveaway (${existingOpenGiveaway.name}). Only one giveaway can be OPEN at a time. Please close it first.`,
      );
    }
  }

  /**
   * Calculate tickets for a participant based on giveaway rules and ticket configuration.
   * 
   * This method uses:
   * 1. GiveawayTicketRuleOverride if exists (giveaway-specific overrides)
   * 2. TicketGlobalRule (default rules for the admin user)
   * 3. TicketGlobalDonationRule / GiveawayDonationRuleOverride for donation-based tickets
   * 
   * Note: The donation window is ignored for now.
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
    // Get giveaway with donation configs to check which donation types are enabled
    const giveaway = await this.prisma.giveaway.findFirst({
      where: {
        id: input.giveawayId,
        userId: input.adminUserId,
      },
      include: {
        donationConfigs: true,
      },
    });

    if (!giveaway) {
      throw new NotFoundException(`Giveaway with ID ${input.giveawayId} not found`);
    }

    // 1. Calculate base tickets from role (check override first, then global rule)
    let baseTickets = 0;

    // Convert platform-specific NON_SUB (TWITCH_NON_SUB, KICK_NON_SUB, YOUTUBE_NON_SUB) to NON_SUB for database lookup
    let normalizedRole = input.role;
    if (input.role === 'TWITCH_NON_SUB' || input.role === 'KICK_NON_SUB' || input.role === 'YOUTUBE_NON_SUB') {
      normalizedRole = 'NON_SUB';
    }

    // Check for giveaway-specific override
    const override = await this.prisma.giveawayTicketRuleOverride.findUnique({
      where: {
        giveawayId_role: {
          giveawayId: input.giveawayId,
          role: input.role, // Use original role for override lookup (overrides use platform-specific format)
        },
      },
    });

    if (override) {
      baseTickets = override.ticketsPerUnit;
    } else {
      // Use global rule (platform is required, use normalized role for database lookup)
      const globalRule = await this.prisma.ticketGlobalRule.findUnique({
        where: {
          userId_platform_role: {
            userId: input.adminUserId,
            platform: input.platform,
            role: normalizedRole, // Use normalized role (NON_SUB) for database lookup
          },
        },
      });

      if (globalRule) {
        baseTickets = globalRule.ticketsPerUnit;
      }
    }

    // 2. Calculate bits tickets (if enabled via donation config)
    let bitsTickets = 0;
    const bitsConfig = giveaway.donationConfigs.find(
      (config) => config.platform === input.platform && config.unitType === 'BITS',
    );
    if (bitsConfig && input.totalBits && input.totalBits > 0) {
      // Check for giveaway-specific override first
      const donationOverride = await this.prisma.giveawayDonationRuleOverride.findUnique({
        where: {
          giveawayId_platform_unitType: {
            giveawayId: input.giveawayId,
            platform: input.platform,
            unitType: 'BITS',
          },
        },
      });

      if (donationOverride) {
        bitsTickets = Math.floor(
          (input.totalBits / donationOverride.unitSize) * donationOverride.ticketsPerUnitSize,
        );
      } else {
        // Use global rule
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
          bitsTickets = Math.floor((input.totalBits / bitsRule.unitSize) * bitsRule.ticketsPerUnitSize);
        }
      }
    }

    // 3. Calculate gift sub tickets (if enabled via donation config)
    let giftTickets = 0;
    const giftSubConfig = giveaway.donationConfigs.find(
      (config) => config.platform === input.platform && config.unitType === 'GIFT_SUB',
    );
    if (giftSubConfig && input.totalGiftSubs && input.totalGiftSubs > 0) {
      // Check for giveaway-specific override first
      const donationOverride = await this.prisma.giveawayDonationRuleOverride.findUnique({
        where: {
          giveawayId_platform_unitType: {
            giveawayId: input.giveawayId,
            platform: input.platform,
            unitType: 'GIFT_SUB',
          },
        },
      });

      if (donationOverride) {
        giftTickets = Math.floor(
          (input.totalGiftSubs / donationOverride.unitSize) * donationOverride.ticketsPerUnitSize,
        );
      } else {
        // Use global rule
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
          giftTickets = Math.floor((input.totalGiftSubs / giftRule.unitSize) * giftRule.ticketsPerUnitSize);
        }
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
